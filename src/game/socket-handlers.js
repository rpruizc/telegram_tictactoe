import { GameManager } from './game-logic.js';

const gameManager = new GameManager();
const socketToPlayer = new Map();
const playerToSocket = new Map();

export function setupGameSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`👤 Player connected: ${socket.id}`);

    // Handle player joining the game
    socket.on('join-game', (data) => {
      try {
        const { playerId, playerName } = data;
        
        if (!playerId || !playerName) {
          socket.emit('error', { message: 'Player ID and name are required' });
          return;
        }

        // Store socket-player mapping
        socketToPlayer.set(socket.id, { id: playerId, name: playerName });
        playerToSocket.set(playerId, socket.id);

        console.log(`🎮 Player ${playerName} (${playerId}) joined the game queue`);

        // Check if player is already in a game
        const existingGame = gameManager.getGameByPlayerId(playerId);
        if (existingGame) {
          socket.join(`game-${existingGame.id}`);
          socket.emit('game-joined', existingGame.getGameState());
          return;
        }

        // Add to waiting queue and try to match
        const matchResult = gameManager.addWaitingPlayer(playerId, playerName, socket.id);

        if (matchResult.matched) {
          const { game, player1, player2 } = matchResult;
          
          // Join both players to the game room
          const player1Socket = io.sockets.sockets.get(player1.socketId);
          const player2Socket = io.sockets.sockets.get(player2.socketId);

          if (player1Socket && player2Socket) {
            player1Socket.join(`game-${game.id}`);
            player2Socket.join(`game-${game.id}`);

            game.startGame();
            const gameState = game.getGameState();

            // Notify both players
            io.to(`game-${game.id}`).emit('game-matched', gameState);
            
            console.log(`🎯 Game started: ${game.id} between ${player1.name} and ${player2.name}`);
          }
        } else {
          // Player is waiting for a match
          socket.emit('waiting-for-player');
          console.log(`⏳ Player ${playerName} is waiting for a match`);
        }

      } catch (error) {
        console.error('Error in join-game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Handle game moves
    socket.on('make-move', (data) => {
      try {
        const { playerId, position } = data;
        const game = gameManager.getGameByPlayerId(playerId);

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const moveResult = game.makeMove(playerId, position);

        if (!moveResult.success) {
          socket.emit('move-error', { error: moveResult.error });
          return;
        }

        // Broadcast the updated game state to all players in the game
        io.to(`game-${game.id}`).emit('game-updated', moveResult.gameState);

        // If game is finished, handle end game
        if (game.gameState === 'finished') {
          console.log(`🏁 Game ${game.id} finished`);
          
          // Send individual results to each player
          const player1Result = game.getResult(game.player1.id);
          const player2Result = game.getResult(game.player2.id);

          const player1SocketId = playerToSocket.get(game.player1.id);
          const player2SocketId = playerToSocket.get(game.player2.id);

          if (player1SocketId) {
            io.to(player1SocketId).emit('game-result', player1Result);
          }
          if (player2SocketId) {
            io.to(player2SocketId).emit('game-result', player2Result);
          }

          // Clean up game after a delay
          setTimeout(() => {
            gameManager.removeGame(game.id);
          }, 5000);
        }

      } catch (error) {
        console.error('Error in make-move:', error);
        socket.emit('error', { message: 'Failed to make move' });
      }
    });

    // Handle player requesting current game state
    socket.on('get-game-state', (data) => {
      try {
        const { playerId } = data;
        const game = gameManager.getGameByPlayerId(playerId);

        if (game) {
          socket.emit('game-state', game.getGameState());
        } else {
          socket.emit('no-active-game');
        }
      } catch (error) {
        console.error('Error in get-game-state:', error);
        socket.emit('error', { message: 'Failed to get game state' });
      }
    });

    // Handle player leaving game
    socket.on('leave-game', (data) => {
      try {
        const { playerId } = data;
        const game = gameManager.getGameByPlayerId(playerId);

        if (game) {
          const opponent = game.getOpponent(playerId);
          
          // Notify opponent that player left
          if (opponent) {
            const opponentSocketId = playerToSocket.get(opponent.id);
            if (opponentSocketId) {
              io.to(opponentSocketId).emit('opponent-left');
            }
          }

          gameManager.removePlayerFromGame(playerId);
          socket.leave(`game-${game.id}`);
          
          console.log(`👋 Player ${playerId} left the game`);
        }

        gameManager.removeWaitingPlayer(playerId);
      } catch (error) {
        console.error('Error in leave-game:', error);
      }
    });

    // Handle getting game stats
    socket.on('get-stats', () => {
      try {
        const stats = gameManager.getStats();
        socket.emit('stats', stats);
      } catch (error) {
        console.error('Error in get-stats:', error);
      }
    });

    // Handle chat messages (optional feature)
    socket.on('send-message', (data) => {
      try {
        const { playerId, message } = data;
        const game = gameManager.getGameByPlayerId(playerId);

        if (game && message.trim()) {
          const player = game.getPlayerById(playerId);
          if (player) {
            io.to(`game-${game.id}`).emit('chat-message', {
              playerName: player.name,
              message: message.trim(),
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Error in send-message:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      try {
        const playerData = socketToPlayer.get(socket.id);
        
        if (playerData) {
          const { id: playerId, name: playerName } = playerData;
          console.log(`👤 Player ${playerName} (${playerId}) disconnected`);

          // Remove from mappings
          socketToPlayer.delete(socket.id);
          playerToSocket.delete(playerId);

          // Handle game cleanup
          const game = gameManager.getGameByPlayerId(playerId);
          if (game) {
            const opponent = game.getOpponent(playerId);
            
            // Notify opponent
            if (opponent) {
              const opponentSocketId = playerToSocket.get(opponent.id);
              if (opponentSocketId) {
                io.to(opponentSocketId).emit('opponent-disconnected');
              }
            }

            // Remove player from game
            gameManager.removePlayerFromGame(playerId);
          } else {
            // Remove from waiting queue
            gameManager.removeWaitingPlayer(playerId);
          }
        }

        console.log(`📊 Current stats:`, gameManager.getStats());
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

    // Send initial connection confirmation
    socket.emit('connected', { 
      message: 'Connected to Tic-Tac-Toe server',
      timestamp: new Date()
    });
  });

  // Periodic cleanup of abandoned games (runs every 5 minutes)
  setInterval(() => {
    const stats = gameManager.getStats();
    console.log(`🧹 Cleanup check - Active games: ${stats.activeGames}, Waiting players: ${stats.waitingPlayers}`);
    
    // Could implement logic to clean up games that have been inactive for too long
  }, 5 * 60 * 1000);

  console.log('🔌 Socket.IO game handlers set up successfully');
} 