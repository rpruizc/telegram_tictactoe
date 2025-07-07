class TicTacToeGame {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.playerId = null;
        this.playerName = null;
        this.isMyTurn = false;
        
        this.initTelegramWebApp();
        this.initElements();
        this.initSocketConnection();
        this.bindEvents();
    }

    initTelegramWebApp() {
        // Initialize Telegram Web App
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            
            // Configure the app
            tg.ready();
            tg.expand();
            
            // Get user info
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const user = tg.initDataUnsafe.user;
                this.playerId = user.id.toString();
                this.playerName = user.first_name || `Player${user.id}`;
            } else {
                // Fallback for development/testing
                this.playerId = `player_${Math.random().toString(36).substring(2, 15)}`;
                this.playerName = `Player${Math.floor(Math.random() * 1000)}`;
            }

            // Set theme colors
            this.applyTelegramTheme();
        } else {
            // Fallback for development/testing
            this.playerId = `player_${Math.random().toString(36).substring(2, 15)}`;
            this.playerName = `Player${Math.floor(Math.random() * 1000)}`;
            console.log('Running in development mode');
        }
        
        console.log(`Player initialized: ${this.playerName} (${this.playerId})`);
    }

    applyTelegramTheme() {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.themeParams) {
            const theme = window.Telegram.WebApp.themeParams;
            
            // Apply theme variables
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
            }
            if (theme.button_color) {
                document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color);
            }
            if (theme.button_text_color) {
                document.documentElement.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
            }
            if (theme.secondary_bg_color) {
                document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
            }
            if (theme.hint_color) {
                document.documentElement.style.setProperty('--tg-theme-hint-color', theme.hint_color);
            }
        }
    }

    initElements() {
        // Status elements
        this.statusCard = document.getElementById('status-card');
        this.errorMessage = document.getElementById('error-message');
        this.successMessage = document.getElementById('success-message');
        
        // Game elements
        this.playersInfo = document.getElementById('players-info');
        this.gameBoard = document.getElementById('game-board');
        this.cells = document.querySelectorAll('.cell');
        
        // Player elements
        this.player1 = document.getElementById('player1');
        this.player2 = document.getElementById('player2');
        
        // Button elements
        this.findGameBtn = document.getElementById('find-game-btn');
        this.leaveGameBtn = document.getElementById('leave-game-btn');
        
        // Stats elements
        this.gameStats = document.getElementById('game-stats');
        this.activeGamesEl = document.getElementById('active-games');
        this.waitingPlayersEl = document.getElementById('waiting-players');
        this.totalPlayersEl = document.getElementById('total-players');
    }

    initSocketConnection() {
        // Connect to Socket.IO server
        const socketUrl = window.location.origin;
        this.socket = io(socketUrl);

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('Connected to server ✅', 'success');
            this.requestStats();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('Disconnected from server ❌', 'error');
        });

        this.socket.on('connected', (data) => {
            console.log('Server confirmed connection:', data);
        });

        // Game events
        this.socket.on('waiting-for-player', () => {
            this.updateStatus('🔍 Looking for an opponent...', 'info');
        });

        this.socket.on('game-matched', (gameState) => {
            console.log('Game matched!', gameState);
            this.gameState = gameState;
            this.showSuccess('🎯 Opponent found! Game starting...');
            this.initGameUI();
        });

        this.socket.on('game-joined', (gameState) => {
            console.log('Rejoined existing game', gameState);
            this.gameState = gameState;
            this.initGameUI();
        });

        this.socket.on('game-updated', (gameState) => {
            console.log('Game updated', gameState);
            this.gameState = gameState;
            this.updateGameUI();
        });

        this.socket.on('game-result', (result) => {
            console.log('Game result:', result);
            this.handleGameEnd(result);
        });

        this.socket.on('opponent-left', () => {
            this.showError('😔 Your opponent left the game');
            this.resetToMainMenu();
        });

        this.socket.on('opponent-disconnected', () => {
            this.showError('📡 Your opponent disconnected');
            this.resetToMainMenu();
        });

        this.socket.on('stats', (stats) => {
            this.updateStats(stats);
        });

        // Error events
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showError(error.message || 'An error occurred');
        });

        this.socket.on('move-error', (error) => {
            console.error('Move error:', error);
            this.showError(error.error || 'Invalid move');
        });
    }

    bindEvents() {
        // Button events
        this.findGameBtn.addEventListener('click', () => this.findGame());
        this.leaveGameBtn.addEventListener('click', () => this.leaveGame());
        
        // Board events
        this.cells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.makeMove(index));
        });

        // Request stats periodically
        setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.requestStats();
            }
        }, 10000); // Every 10 seconds
    }

    findGame() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }

        this.updateStatus('🔍 Searching for a game...', 'info');
        this.findGameBtn.disabled = true;
        
        this.socket.emit('join-game', {
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    leaveGame() {
        if (this.gameState) {
            this.socket.emit('leave-game', { playerId: this.playerId });
        }
        this.resetToMainMenu();
    }

    makeMove(position) {
        if (!this.gameState || !this.isMyTurn) {
            return;
        }

        if (this.gameState.board[position] !== null) {
            return;
        }

        this.socket.emit('make-move', {
            playerId: this.playerId,
            position: position
        });
    }

    initGameUI() {
        this.statusCard.classList.add('hidden');
        this.playersInfo.classList.remove('hidden');
        this.gameBoard.classList.remove('hidden');
        this.findGameBtn.classList.add('hidden');
        this.leaveGameBtn.classList.remove('hidden');
        this.gameStats.classList.remove('hidden');
        
        this.updateGameUI();
    }

    updateGameUI() {
        if (!this.gameState) return;

        // Update player info
        const player1Name = this.gameState.player1.name;
        const player2Name = this.gameState.player2.name;
        
        this.player1.querySelector('.player-name').textContent = player1Name;
        this.player2.querySelector('.player-name').textContent = player2Name;

        // Highlight current player
        this.player1.classList.remove('current');
        this.player2.classList.remove('current');
        
        if (this.gameState.currentPlayer) {
            if (this.gameState.currentPlayer.id === this.gameState.player1.id) {
                this.player1.classList.add('current');
            } else {
                this.player2.classList.add('current');
            }
        }

        // Update my turn status
        this.isMyTurn = this.gameState.currentPlayer && 
                       this.gameState.currentPlayer.id === this.playerId &&
                       this.gameState.gameState === 'playing';

        // Update board
        this.updateBoard();

        // Update status
        if (this.gameState.gameState === 'playing') {
            if (this.isMyTurn) {
                this.updateStatus('🎯 Your turn!', 'success');
            } else {
                const opponentName = this.gameState.currentPlayer.name;
                this.updateStatus(`⏳ Waiting for ${opponentName}...`, 'info');
            }
        }
    }

    updateBoard() {
        this.cells.forEach((cell, index) => {
            const value = this.gameState.board[index];
            
            // Clear previous classes
            cell.classList.remove('x', 'o', 'winning');
            
            if (value === 'X') {
                cell.textContent = '❌';
                cell.classList.add('x');
            } else if (value === 'O') {
                cell.textContent = '⭕';
                cell.classList.add('o');
            } else {
                cell.textContent = '';
            }

            // Highlight winning combination
            if (this.gameState.winningCombination && 
                this.gameState.winningCombination.includes(index)) {
                cell.classList.add('winning');
            }
        });
    }

    handleGameEnd(result) {
        const messages = {
            win: '🎉 You won! Congratulations!',
            lose: '😅 You lost! Better luck next time!',
            tie: '🤝 It\'s a tie! Great game!'
        };

        const message = messages[result.result] || 'Game finished!';
        this.showSuccess(`${message} (${result.duration}s)`);

        // Send result to Telegram
        this.sendResultToTelegram(result);

        // Reset to main menu after delay
        setTimeout(() => {
            this.resetToMainMenu();
        }, 3000);
    }

    sendResultToTelegram(result) {
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                const data = {
                    type: 'game_result',
                    result: result.result,
                    duration: result.duration
                };
                
                window.Telegram.WebApp.sendData(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending data to Telegram:', error);
            }
        }
    }

    resetToMainMenu() {
        this.gameState = null;
        this.isMyTurn = false;
        
        this.statusCard.classList.remove('hidden');
        this.playersInfo.classList.add('hidden');
        this.gameBoard.classList.add('hidden');
        this.findGameBtn.classList.remove('hidden');
        this.leaveGameBtn.classList.add('hidden');
        
        this.findGameBtn.disabled = false;
        this.updateStatus('Ready to play! 🎮', 'success');
        
        // Clear board
        this.cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winning');
        });
    }

    requestStats() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('get-stats');
        }
    }

    updateStats(stats) {
        this.activeGamesEl.textContent = stats.activeGames;
        this.waitingPlayersEl.textContent = stats.waitingPlayers;
        this.totalPlayersEl.textContent = stats.totalPlayers;
        
        if (!this.gameStats.classList.contains('hidden')) {
            this.gameStats.classList.add('fade-in');
        }
    }

    updateStatus(message, type = 'info') {
        const statusHTML = {
            info: `<div class="loading"><div class="spinner"></div><span>${message}</span></div>`,
            success: `<div style="color: #4ecdc4;">✅ ${message}</div>`,
            error: `<div style="color: #ff6b6b;">❌ ${message}</div>`
        };

        this.statusCard.innerHTML = statusHTML[type] || statusHTML.info;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.errorMessage.classList.add('hidden');
        }, 5000);
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.successMessage.classList.add('hidden');
        }, 5000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TicTacToeGame();
});

// Handle page visibility change (pause/resume)
document.addEventListener('visibilitychange', () => {
    if (window.game) {
        if (document.hidden) {
            console.log('Game paused');
        } else {
            console.log('Game resumed');
            window.game.requestStats();
        }
    }
}); 