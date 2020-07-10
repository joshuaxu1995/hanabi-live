import produce, { Draft } from 'immer';
import * as turnRules from '../rules/turn';
import { GameAction } from '../types/actions';
import GameMetadata from '../types/GameMetadata';
import TurnState from '../types/TurnState';

const turnReducer = produce((
  state: Draft<TurnState>,
  action: GameAction,
  metadata: GameMetadata,
  deckSize: number,
  clueTokens: number,
) => {
  const numPlayers = metadata.options.numPlayers;
  let characterID = null;
  if (state.currentPlayerIndex !== null) {
    characterID = metadata.characterAssignments[state.currentPlayerIndex];
    if (characterID === undefined) {
      throw new Error(`The character ID for player ${state.currentPlayerIndex} was undefined in the "turnReducer()" function.`);
    }
  }

  switch (action.type) {
    case 'play':
    case 'discard': {
      state.cardsPlayedOrDiscardedThisTurn += 1;

      if (deckSize === 0) {
        nextTurn(state, numPlayers, deckSize, characterID);
      }

      break;
    }

    case 'clue': {
      if (turnRules.shouldEndTurnAfterClue(state.cluesGivenThisTurn, characterID)) {
        nextTurn(state, numPlayers, deckSize, characterID);
      }
      break;
    }

    case 'draw': {
      if (turnRules.shouldEndTurnAfterDraw(
        state.cardsPlayedOrDiscardedThisTurn,
        characterID,
        clueTokens,
      )) {
        nextTurn(state, numPlayers, deckSize, characterID);
      }
      break;
    }

    case 'gameOver': {
      state.currentPlayerIndex = null;
      break;
    }

    // It is now a new turn
    // {num: 0, type: "turn", who: 1}
    case 'turn': {
      // TEMP: At this point, check that the local state matches the server
      if (state.turnNum !== action.num && state.currentPlayerIndex !== null) {
        // Ignore turns that occur after the game has already ended
        console.warn(`The turns from the client and the server do not match on turn ${state.turnNum}.`);
        console.warn(`Client = ${state.turnNum}, Server = ${action.num}`);
      }

      // TEMP: the client should set the "currentPlayerIndex" index to -1 when the game is over
      if (action.who === -1 && state.currentPlayerIndex !== null) {
        state.currentPlayerIndex = null;
        console.log('The "turnReducer()" function had to manually set the "currentPlayerIndex" to null.');
        // This condition will be triggered in Jest tests because the "loadGameJSON.ts" file does
        // not know how to properly create a "gameOver" action
      }

      if (state.currentPlayerIndex !== action.who && state.currentPlayerIndex !== null) {
        // TODO
        console.warn(`The currentPlayerIndex from the client and the server do not match on turn ${state.turnNum}.`);
        console.warn(`Client = ${state.currentPlayerIndex}, Server = ${action.who}`);
      }
      break;
    }

    default: {
      break;
    }
  }
}, {} as TurnState);

export default turnReducer;

function nextTurn(
  state: Draft<TurnState>,
  numPlayers: number,
  deckSize: number,
  characterID: number | null,
) {
  state.turnNum += 1;

  state.currentPlayerIndex = turnRules.getNextPlayerIndex(
    state.currentPlayerIndex,
    numPlayers,
    state.playOrderInverted,
  );

  if (turnRules.shouldPlayOrderInvert(characterID)) {
    state.playOrderInverted = !state.playOrderInverted;
  }

  if (deckSize === 0 && state.endTurnNum === null) {
    state.endTurnNum = state.turnNum + numPlayers;
  }

  state.cardsPlayedOrDiscardedThisTurn = 0;
  state.cluesGivenThisTurn = 0;
}
