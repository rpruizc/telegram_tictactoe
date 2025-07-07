import { Telegraf, Markup } from 'telegraf';

export function createTelegramBot(botToken, miniAppUrl) {
  if (!botToken) {
    throw new Error('BOT_TOKEN is required');
  }

  const bot = new Telegraf(botToken);

  // Start command
  bot.start((ctx) => {
    const firstName = ctx.from.first_name || 'Player';
    
    ctx.reply(
      `🎮 Welcome to Tic-Tac-Toe, ${firstName}!\n\n` +
      `This is a real-time multiplayer game where you can challenge other players to a classic game of Tic-Tac-Toe.\n\n` +
      `🎯 How to play:\n` +
      `• Click "Play Game" to start\n` +
      `• Wait for another player to join\n` +
      `• Take turns placing X's and O's\n` +
      `• First to get 3 in a row wins!\n\n` +
      `Ready to play?`,
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Play Game', `${miniAppUrl || 'https://example.com/game'}`)]
      ])
    );
  });

  // Help command
  bot.help((ctx) => {
    ctx.reply(
      `🎮 Tic-Tac-Toe Game Help\n\n` +
      `Commands:\n` +
      `/start - Start the bot and get the game link\n` +
      `/play - Quick access to the game\n` +
      `/rules - Learn how to play\n` +
      `/help - Show this help message\n\n` +
      `The game is played in real-time with other Telegram users. Have fun!`
    );
  });

  // Play command
  bot.command('play', (ctx) => {
    ctx.reply(
      `🎯 Ready to play Tic-Tac-Toe?\n\n` +
      `Click the button below to start a new game!`,
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Play Now', `${miniAppUrl || 'https://example.com/game'}`)]
      ])
    );
  });

  // Rules command
  bot.command('rules', (ctx) => {
    ctx.reply(
      `📋 Tic-Tac-Toe Rules\n\n` +
      `🎯 Objective: Be the first to get 3 of your symbols in a row!\n\n` +
      `🎮 How to Play:\n` +
      `1. The game is played on a 3×3 grid\n` +
      `2. Players take turns placing their symbol (X or O)\n` +
      `3. First player is always X, second player is O\n` +
      `4. Get 3 in a row (horizontally, vertically, or diagonally) to win\n` +
      `5. If the grid fills up with no winner, it's a tie!\n\n` +
      `🚀 This version features:\n` +
      `• Real-time multiplayer\n` +
      `• Automatic matchmaking\n` +
      `• Instant updates\n` +
      `• Beautiful interface\n\n` +
      `Good luck! 🍀`
    );
  });

  // Handle callback queries for web app
  bot.on('callback_query', (ctx) => {
    ctx.answerCbQuery();
  });

  // Handle web app data (when user sends data back from the mini app)
  bot.on('web_app_data', (ctx) => {
    try {
      const data = JSON.parse(ctx.webAppData.data);
      
      if (data.type === 'game_result') {
        const { result, score, duration } = data;
        let message = '';
        
        switch (result) {
          case 'win':
            message = `🎉 Congratulations! You won the game!\n⏱️ Game duration: ${duration}s`;
            break;
          case 'lose':
            message = `😅 Better luck next time! You lost this round.\n⏱️ Game duration: ${duration}s`;
            break;
          case 'tie':
            message = `🤝 It's a tie! Great game!\n⏱️ Game duration: ${duration}s`;
            break;
          default:
            message = `🎮 Thanks for playing!`;
        }
        
        ctx.reply(message, 
          Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Play Again', `${miniAppUrl || 'https://example.com/game'}`)]
          ])
        );
      }
    } catch (error) {
      console.error('Error parsing web app data:', error);
      ctx.reply('🎮 Thanks for playing!');
    }
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ Something went wrong. Please try again later.');
  });

  // Log bot startup
  bot.telegram.getMe().then((botInfo) => {
    console.log(`🤖 Bot @${botInfo.username} is ready!`);
  });

  return bot;
} 