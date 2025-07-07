export class TicTacToeGame {
  constructor(player1Id, player2Id) {
    this.id = this.generateGameId();
    this.player1 = { id: player1Id, symbol: 'X', name: null };
    this.player2 = { id: player2Id, symbol: 'O', name: null };
    this.currentPlayer = this.player1;
    this.board = Array(9).fill(null);
    this.gameState = 'waiting'; // 'waiting', 'playing', 'finished'
    this.winner = null;
    this.winningCombination = null;
    this.createdAt = new Date();
    this.moves = [];
  }

  generateGameId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  setPlayerNames(player1Name, player2Name) {
    this.player1.name = player1Name;
    this.player2.name = player2Name;
  }

  startGame() {
    if (this.gameState === 'waiting') {
      this.gameState = 'playing';
      return true;
    }
    return false;
  }

  makeMove(playerId, position) {
    // Validate move
    if (this.gameState !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    if (this.currentPlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (position < 0 || position > 8) {
      return { success: false, error: 'Invalid position' };
    }

    if (this.board[position] !== null) {
      return { success: false, error: 'Position already taken' };
    }

    // Make the move
    this.board[position] = this.currentPlayer.symbol;
    this.moves.push({
      playerId,
      symbol: this.currentPlayer.symbol,
      position,
      timestamp: new Date()
    });

    // Check for win or tie
    const result = this.checkGameEnd();
    
    if (result.gameEnded) {
      this.gameState = 'finished';
      this.winner = result.winner;
      this.winningCombination = result.winningCombination;
    } else {
      // Switch players
      this.currentPlayer = this.currentPlayer === this.player1 ? this.player2 : this.player1;
    }

    return {
      success: true,
      gameState: this.getGameState()
    };
  }

  checkGameEnd() {
    // Define winning combinations
    const winningCombinations = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    // Check for wins
    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return {
          gameEnded: true,
          winner: this.board[a] === 'X' ? this.player1 : this.player2,
          winningCombination: combination
        };
      }
    }

    // Check for tie
    if (this.board.every(cell => cell !== null)) {
      return {
        gameEnded: true,
        winner: null, // Tie
        winningCombination: null
      };
    }

    return { gameEnded: false };
  }

  getGameState() {
    return {
      id: this.id,
      board: this.board,
      currentPlayer: this.currentPlayer,
      player1: this.player1,
      player2: this.player2,
      gameState: this.gameState,
      winner: this.winner,
      winningCombination: this.winningCombination,
      moves: this.moves,
      createdAt: this.createdAt
    };
  }

  getPlayerById(playerId) {
    if (this.player1.id === playerId) return this.player1;
    if (this.player2.id === playerId) return this.player2;
    return null;
  }

  isPlayerInGame(playerId) {
    return this.player1.id === playerId || this.player2.id === playerId;
  }

  getOpponent(playerId) {
    if (this.player1.id === playerId) return this.player2;
    if (this.player2.id === playerId) return this.player1;
    return null;
  }

  getGameDuration() {
    return Math.floor((new Date() - this.createdAt) / 1000);
  }

  getResult(playerId) {
    if (this.gameState !== 'finished') return null;

    if (this.winner === null) {
      return { result: 'tie', duration: this.getGameDuration() };
    }

    if (this.winner.id === playerId) {
      return { result: 'win', duration: this.getGameDuration() };
    }

    return { result: 'lose', duration: this.getGameDuration() };
  }
}

export class GameManager {
  constructor() {
    this.games = new Map();
    this.waitingPlayers = [];
    this.playerToGame = new Map();
  }

  addWaitingPlayer(playerId, playerName, socketId) {
    // Remove player if already waiting
    this.removeWaitingPlayer(playerId);
    
    this.waitingPlayers.push({
      id: playerId,
      name: playerName,
      socketId: socketId,
      joinedAt: new Date()
    });

    return this.tryMatchPlayers();
  }

  removeWaitingPlayer(playerId) {
    this.waitingPlayers = this.waitingPlayers.filter(player => player.id !== playerId);
  }

  tryMatchPlayers() {
    if (this.waitingPlayers.length >= 2) {
      const player1 = this.waitingPlayers.shift();
      const player2 = this.waitingPlayers.shift();

      const game = new TicTacToeGame(player1.id, player2.id);
      game.setPlayerNames(player1.name, player2.name);
      
      this.games.set(game.id, game);
      this.playerToGame.set(player1.id, game.id);
      this.playerToGame.set(player2.id, game.id);

      return {
        matched: true,
        game,
        player1,
        player2
      };
    }

    return { matched: false };
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  getGameByPlayerId(playerId) {
    const gameId = this.playerToGame.get(playerId);
    return gameId ? this.games.get(gameId) : null;
  }

  removeGame(gameId) {
    const game = this.games.get(gameId);
    if (game) {
      this.playerToGame.delete(game.player1.id);
      this.playerToGame.delete(game.player2.id);
      this.games.delete(gameId);
    }
  }

  removePlayerFromGame(playerId) {
    const gameId = this.playerToGame.get(playerId);
    if (gameId) {
      this.playerToGame.delete(playerId);
      
      // If this was the last player, remove the game
      const game = this.games.get(gameId);
      if (game) {
        const otherPlayerId = game.player1.id === playerId ? game.player2.id : game.player1.id;
        if (!this.playerToGame.has(otherPlayerId)) {
          this.games.delete(gameId);
        }
      }
    }
    
    this.removeWaitingPlayer(playerId);
  }

  getStats() {
    return {
      activeGames: this.games.size,
      waitingPlayers: this.waitingPlayers.length,
      totalPlayers: this.playerToGame.size + this.waitingPlayers.length
    };
  }
} 