import { playerActionTemplate } from "../consts/GameState";

let prevState = null;

export const getActionBasedOnGameState = (sessionId, state) => {
    console.log("state in helper", state.gameStarted);
    prevState = this;
    return {
        ...playerActionTemplate,
        bet: getBettingInterval(state.players[sessionId].chips)
    }
};

export const getStateBasedOnAction = (sessionId, state) => {
    console.log("prevstate in getStateBasedOnAction", prevState);
};

const getBettingInterval = (playerTotalChips) => {
  return [0, playerTotalChips];
};