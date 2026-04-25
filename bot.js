require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

// Import functions from your specific shared-db structure
const { 
    ensureUserExists, 
    getUser, 
    saveUserLanguage,
    getVideoFileId,
    saveVideoFileId,
    setUserBalance
} = require('./shared-db');


const bot = new Telegraf(process.env.BOT_TOKEN);
const webAppUrl = process.env.MINIAPP_URL;
const videoPath = path.resolve(__dirname, 'assets', 'crystal.mp4');
const ADMIN_ID = 7992527833; // <--- DEFINE ADMIN ID



async function sendMainMenu(ctx, language, isLanguageChange = false) {

    let caption = `<b>Welcome to the RUBY.</b> 💎\n\n` +
                  `Your exclusive experience awaits.\n` +
                  `Tap the button below to enter the lobby.`;
    
    if (language === 'UA') {
        caption = `<b>Ласкаво просимо в RUBY.</b> 💎\n\n` +
                  `Ваш ексклюзивний досвід чекає.\n` +
                  `Натисніть кнопку нижче, щоб увійти.`;
    }

    const buttonText = language === 'UA' ? '🚀 ГРАТИ ЗАРАЗ' : '🚀 PLAY NOW';
    const changeLangText = language === 'UA' ? '🌐 Змінити мову' : '🌐 Change Language';


    const inlineKeyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(buttonText, webAppUrl)],
        [Markup.button.callback(changeLangText, 'user_change_language')]
    ]);

    try {
        const cachedFileId = getVideoFileId(); // Sync call to DB


        if (isLanguageChange && ctx.callbackQuery) {
            try {
                // If we have video ID, try to edit media (clean transition)
                if (cachedFileId) {
                    await ctx.editMessageMedia({
                        type: 'animation',
                        media: cachedFileId,
                        caption: caption,
                        parse_mode: 'HTML'
                    });
                    await ctx.editMessageReplyMarkup(inlineKeyboard.reply_markup);
                } else {
                    // Fallback: Just edit text
                    await ctx.editMessageCaption(caption, { 
                        parse_mode: 'HTML', 
                        reply_markup: inlineKeyboard.reply_markup 
                    });
                }
            } catch (e) {
                // If content is identical, Telegram errors. Ignore it.
                await ctx.editMessageCaption(caption, { parse_mode: 'HTML', ...inlineKeyboard }).catch(() => {});
            }
            return;
        }


        if (cachedFileId) {
            // Fast Path: Send using File ID
            try {
                await ctx.replyWithAnimation(cachedFileId, {
                    caption: caption,
                    parse_mode: 'HTML',
                    ...inlineKeyboard
                });
            } catch (e) {
                console.log('Cached File ID invalid. Re-uploading...');
                throw new Error('Cache invalid'); // Trigger catch block to re-upload
            }
        } else {
            // Slow Path: Upload file first time
            throw new Error('No cache');
        }

    } catch (error) {
        // Fallback: Upload from disk
        console.log('Uploading video from disk...');
        try {
            const sentMessage = await ctx.replyWithAnimation({ source: videoPath }, {
                caption: caption,
                parse_mode: 'HTML',
                ...inlineKeyboard
            });

            // Cache the file_id for next time
            const fileId = sentMessage.animation?.file_id || sentMessage.document?.file_id;
            if (fileId) {
                saveVideoFileId(fileId);
                console.log('Video cached! ID:', fileId);
            }
        } catch (uploadError) {
            console.error('Video upload failed:', uploadError);
            // Emergency Fallback: Send text only if video fails
            ctx.reply(caption, { parse_mode: 'HTML', ...inlineKeyboard });
        }
    }
}



bot.start(async (ctx) => {
    const userId = ctx.from.id;

    // Check if user exists BEFORE we update them (so we know if they are new)
    const existingUser = getUser(userId);

    // Prepare data for DB
    const userData = {
        id: userId,
        first_name: ctx.from.first_name,
        username: ctx.from.username,
        photo_url: null // Bot API doesn't give photo URL directly in message
    };

    // Create or Update user in DB (This handles users/user_stats tables)
    ensureUserExists(userData);

    if (existingUser) {
        // Returning User -> Show Main Menu
        await sendMainMenu(ctx, existingUser.language || 'EN');
    } else {
        // New User -> Show Language Picker
        await ctx.reply(
            '🌐 Choose your language / Оберіть мову:',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🇺🇸 English', 'set_lang_en'),
                    Markup.button.callback('🇺🇦 Українська', 'set_lang_ua')
                ]
            ])
        );
    }
});
bot.command('set', async (ctx) => {

    if (ctx.from.id !== ADMIN_ID) {
        return; // Ignore non-admins completely
    }


    const parts = ctx.message.text.trim().split(/\s+/);
    
    if (parts.length !== 3) {
        return ctx.reply('⚠️ Usage: `/set <userId> <amount>`', { parse_mode: 'Markdown' });
    }

    const targetUserId = parseInt(parts[1]);
    const amount = parseInt(parts[2]);


    if (isNaN(targetUserId) || isNaN(amount)) {
        return ctx.reply('⚠️ User ID and Amount must be numbers.');
    }


    const success = setUserBalance(targetUserId, amount);

    if (success) {
        await ctx.reply(`✅ <b>Success!</b>\nUser: <code>${targetUserId}</code>\nNew Balance: <b>${amount} RUBY</b>`, { parse_mode: 'HTML' });
        
        // Optional: Notify the user that their balance changed
        try {
            await ctx.telegram.sendMessage(targetUserId, `💎 <b>Admin Update:</b> Your balance has been set to <b>${amount}</b> RUBY.`, { parse_mode: 'HTML' });
        } catch (e) {
            // User might have blocked the bot, ignore error
        }
    } else {
        await ctx.reply(`❌ <b>Failed.</b>\nUser <code>${targetUserId}</code> not found or DB error. Make sure they have started the bot.`, { parse_mode: 'HTML' });
    }
});



bot.action('set_lang_en', async (ctx) => {
    saveUserLanguage(ctx.from.id, 'EN');
    await ctx.deleteMessage(); // Remove picker
    await sendMainMenu(ctx, 'EN');
});

bot.action('set_lang_ua', async (ctx) => {
    saveUserLanguage(ctx.from.id, 'UA');
    await ctx.deleteMessage();
    await sendMainMenu(ctx, 'UA');
});


bot.action('user_change_language', async (ctx) => {
    const languagePrompt = `Select language / Оберіть мову:`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🇺🇸 English', 'change_lang_en'),
            Markup.button.callback('🇺🇦 Українська', 'change_lang_ua')
        ],
        [Markup.button.callback('🔙 Back / Назад', 'cancel_language_change')]
    ]);

    // Delete the video message to show a clean selection menu
    try {
        await ctx.deleteMessage();
        await ctx.reply(languagePrompt, keyboard);
    } catch (e) {
        await ctx.reply(languagePrompt, keyboard);
    }
    await ctx.answerCbQuery();
});


bot.action('change_lang_en', async (ctx) => {
    saveUserLanguage(ctx.from.id, 'EN');
    await ctx.deleteMessage(); 
    await sendMainMenu(ctx, 'EN', false); // false = send new message
});

bot.action('change_lang_ua', async (ctx) => {
    saveUserLanguage(ctx.from.id, 'UA');
    await ctx.deleteMessage();
    await sendMainMenu(ctx, 'UA', false);
});

bot.action('cancel_language_change', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.deleteMessage();
    await sendMainMenu(ctx, user.language || 'EN', false);
});


bot.launch().then(() => {
    console.log('💎 RUBY Casino Bot Started.');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));