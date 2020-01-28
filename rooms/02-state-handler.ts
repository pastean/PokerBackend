import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Pack, Hand } from "tx-holdem";
import { getActionBasedOnGameState, getStateBasedOnAction } from "../helpers/HeadsupHelpers"
import { GamePhases } from "../consts/GamePhases";

export class Player extends Schema {
    @type("number")
    chips = 1500;

    @type("number")
    timeBank = 15;

    hand = null;

    client = null;

}

export class Card extends Schema {
    @type("string")
    public suit = null;

    @type("string")
    public rank = null;

    constructor(suit: string, rank: string){
        super();
        this.suit = suit;
        this.rank = rank;
    }
}

export class State extends Schema {
    // Non Synchronized state
    playersArray = [];
    pack = new Pack();

    // Synchronized state
    @type("boolean")
    gameStarted = false;

    @type("string")
    currentPhase = GamePhases.PREFLOP;

    @type("uint8")
    currentPlayer = 0;

    @type("uint8")
    dealer = 0;

    @type({ map: Player })
    players = new MapSchema<Player>();

    @type([ Card ])
    board = new ArraySchema<Card>();

    @type("uint64")
    pot = 0;


    // State modifiers
    createPlayer (client: Client) {
        this.players[client.sessionId] = new Player();
        this.players[client.sessionId].client = client;
    }

    removePlayer (id: string) {
        delete this.players[ id ];
    }

    startGame () {
        this.gameStarted = true;
        this.playersArray = Object.keys(this.players);
    }

    getHand (id: string) {
        let hand = new Hand([
            this.pack.createCard(),
            this.pack.createCard(),
        ]);
        this.players[id].hand = hand;
        return hand;
    }

    dealFlop () {
        const card0 = this.pack.createCard().toJSON();
        const card1 = this.pack.createCard().toJSON();
        const card2 = this.pack.createCard().toJSON();
        this.board[0] = new Card(card0.suit, card0.rank.toString());
        this.board[1] = new Card(card1.suit, card1.rank.toString());
        this.board[2] = new Card(card2.suit, card2.rank.toString());
        return this.board;
    }

    dealTurn () {

    }

    dealRiver () {

    }

    checkWinner () {

    }

    makeNextPlayerActive () {
        // write 2 as a constant and use it for maxClients as well
        this.currentPlayer = (this.currentPlayer + 1)%2;
    }

    currentPlayerBet (sessionId, amount) {
        console.log("bet", amount)
    }

    playerFolded (sessionId) {
        console.log("folded")
    }

    nextPlayerAvailableAction (sessionId) {
        const hasAction = this.playersArray[this.currentPlayer] === sessionId;
        if (hasAction) {
            return getActionBasedOnGameState(sessionId, this);
        }
        return {
            action: false,
            opponentWaitTime: 20000
        };
    }

    checkMessageAndUpdateState (sessionId, response) {
        if (sessionId === this.playersArray[this.currentPlayer]) {
            const nextStateFields = getStateBasedOnAction(sessionId, response);

            if (response.action === "check") {
                this.makeNextPlayerActive();
            }
            if (response.action === "bet") {
                this.currentPlayerBet(sessionId, response.amount)
            }
            if (response.action === "fold") {
                this.playerFolded(sessionId);
            }
        } else {
            console.log("bad client message");
        }
    }


}

export class HeadsUpRoom extends Room<State> {
    maxClients = 2;

    onCreate (options) {
        console.log("StateHandlerRoom created!", options);

        this.setState(new State());
    }

    async onJoin (client: Client) {
        this.state.createPlayer(client);
        if (this.locked){
            this.state.startGame();
            const playerOneClient = this.state.players[this.state.playersArray[0]].client;
            const playerTwoClient = this.state.players[this.state.playersArray[1]].client;

            this.send(
                playerOneClient,
                {
                    ...this.state.getHand(playerOneClient.sessionId),
                    action: this.state.nextPlayerAvailableAction(playerOneClient.sessionId)
                }
            );

            this.send(
                playerTwoClient,
                {
                    ...this.state.getHand(playerTwoClient.sessionId),
                    action: this.state.nextPlayerAvailableAction(playerTwoClient.sessionId)
                }
            );
            // this.state.increaseTurn();
        }
    }

    async onLeave (client) {
        this.state.removePlayer(client.sessionId);
        if (this.state.gameStarted){
            // if the game has started and a client leaves,
            // tell the remaining client that the game has ended
            const playersArray = Object.keys(this.state.players);
            const clientStillInRoom = this.state.players[playersArray[0]].client;
            this.send(clientStillInRoom, { game_ended: true });
            try {
                await this.disconnect();
            } catch (e) {
                console.log("disconnection error");
            }
        }
    }

    onMessage (client, data) {
        console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
        this.state.checkMessageAndUpdateState(client.sessionId, data);
    }

    onDispose () {
        console.log("Dispose StateHandlerRoom");
    }

}
