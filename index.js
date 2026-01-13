const { 
    Client, GatewayIntentBits, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    Collection, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ---- CONFIG ----
const TOKEN = process.env.TOKEN;
const clientId = process.env.client_id;
const guildId = process.env.guild_id;

// ---- COMMANDS ----
const commands = [
    new SlashCommandBuilder().setName('blackjack').setDescription('Speel blackjack!'),
    new SlashCommandBuilder().setName('munt').setDescription('Gooi een munt!'),
    new SlashCommandBuilder().setName('dobbelsteen').setDescription('Gooi een dobbelsteen').addIntegerOption(opt => opt.setName('zijden').setDescription('Aantal zijden').setRequired(false)),
    new SlashCommandBuilder().setName('steenpapierschaar').setDescription('Speel steen-papier-schaar!'),
    new SlashCommandBuilder().setName('hooglaag').setDescription('High/Low spel!'),
];

// ---- REGISTER COMMANDS ----
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Commands registreren...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands.map(c => c.toJSON()) }
        );
        console.log('Commands geregistreerd!');
    } catch (err) {
        console.error(err);
    }
})();

// ---- SESSIONS ----
const blackjackSessions = new Collection();
const highLowSessions = new Collection();

// ---- HELPER FUNCTIES ----
const suits = ['♠','♥','♦','♣'];
const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
function drawCard() { return `${cards[Math.floor(Math.random()*cards.length)]}${suits[Math.floor(Math.random()*suits.length)]}`; }

function calculateHand(hand){
    let sum=0, aces=0;
    hand.forEach(card=>{
        let value=card.slice(0,-1);
        if(['J','Q','K'].includes(value)) sum+=10;
        else if(value==='A'){sum+=11; aces++;}
        else sum+=parseInt(value);
    });
    while(sum>21 && aces>0){sum-=10; aces--;}
    return sum;
}

// ---- KANAAL IDS ----
const channels = {
    munt: '1454800920562106409',
    dobbelsteen: '1454801178251624500',
    sps: '1454801408221118659',
    hooglaag: '1454801622118170769',
    blackjack: '1454801929543614627'
};

// ---- INTERACTION LISTENER ----
client.on('interactionCreate', async interaction => {

    // ---- SLASH COMMANDS ----
    if(interaction.isChatInputCommand()){
        const cmd = interaction.commandName;

        // --- /munt ---
        if(cmd==='munt'){
            if(interaction.channel.id !== channels.munt) return interaction.reply({ content:'❌ Dit command kan hier niet gebruikt worden.', ephemeral:true });
            await interaction.reply({
                embeds:[new EmbedBuilder()
                    .setTitle('🪙 Munt opgooien')
                    .setDescription(`Je gooit een munt en krijgt: **${Math.random()<0.5?'Kop':'Munt'}**`)
                    .setColor('Random')
                ]
            });
        }

        // --- /dobbelsteen ---
        else if(cmd==='dobbelsteen'){
            if(interaction.channel.id !== channels.dobbelsteen) return interaction.reply({ content:'❌ Dit command kan hier niet gebruikt worden.', ephemeral:true });
            const zijden = interaction.options.getInteger('zijden')||6;
            const resultaat = Math.floor(Math.random()*zijden)+1;
            await interaction.reply({
                embeds:[new EmbedBuilder()
                    .setTitle('🎲 Dobbelsteen')
                    .setDescription(`Je gooit een dobbelsteen met ${zijden} zijden en krijgt **${resultaat}**`)
                    .setColor('Random')
                ]
            });
        }

        // --- /steenpapierschaar ---
        else if(cmd==='steenpapierschaar'){
            if(interaction.channel.id !== channels.sps) return interaction.reply({ content:'❌ Dit command kan hier niet gebruikt worden.', ephemeral:true });
            const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('sps_steen').setLabel('🪨 Steen').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('sps_papier').setLabel('📄 Papier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('sps_schaar').setLabel('✂️ Schaar').setStyle(ButtonStyle.Primary)
            );
            await interaction.reply({
                embeds:[new EmbedBuilder()
                    .setTitle('🪨📄✂️ Steen-Papier-Schaar')
                    .setDescription('Klik op een knop om te spelen!')
                    .setColor('Random')
                ],
                components:[row]
            });
        }

        // --- /hooglaag ---
        else if(cmd==='hooglaag'){
            if(interaction.channel.id !== channels.hooglaag) return interaction.reply({ content:'❌ Dit command kan hier niet gebruikt worden.', ephemeral:true });
            const nummer = Math.floor(Math.random()*100)+1;
            highLowSessions.set(interaction.user.id, nummer);
            const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hl_hoger').setLabel('Hoger').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('hl_lager').setLabel('Lager').setStyle(ButtonStyle.Danger)
            );
            await interaction.reply({
                embeds:[new EmbedBuilder()
                    .setTitle('⬆️⬇️ Hoog/Laag')
                    .setDescription('Het getal is tussen 1 en 100. Raad of het volgende hoger of lager is!')
                    .setColor('Random')
                ],
                components:[row]
            });
        }

        // --- /blackjack ---
        else if(cmd==='blackjack'){
            if(interaction.channel.id !== channels.blackjack) return interaction.reply({ content:'❌ Dit command kan hier niet gebruikt worden.', ephemeral:true });
            await interaction.deferReply();
            const playerHand = [drawCard(), drawCard()];
            const dealerHand = [drawCard(), drawCard()];
            blackjackSessions.set(interaction.user.id, { playerHand, dealerHand, finished:false });

            const embed = new EmbedBuilder()
            .setTitle('🃏 Blackjack')
            .addFields(
                { name:'Jouw hand', value:`${playerHand.join(', ')} (Totaal: ${calculateHand(playerHand)})`, inline:true },
                { name:'Hand van dealer', value:`${dealerHand[0]}, ?`, inline:true }
            )
            .setColor('Random')
            .setFooter({ text:'Klik op Hit of Stand!' });

            const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ embeds:[embed], components:[row] });
        }
    }

    // ---- BUTTONS ----
    if(interaction.isButton()){
        const id = interaction.customId;

        // --- SPS ---
        if(id.startsWith('sps_')){
            if(interaction.channel.id !== channels.sps) return interaction.reply({ content:'❌ Dit kan hier niet gebruikt worden.', ephemeral:true });
            const keuzes = ['steen','papier','schaar'];
            const userKeuze = id.split('_')[1];
            const botKeuze = keuzes[Math.floor(Math.random()*3)];
            let result = 'Gelijkspel!';
            if(
                (userKeuze==='steen' && botKeuze==='schaar')||
                (userKeuze==='papier' && botKeuze==='steen')||
                (userKeuze==='schaar' && botKeuze==='papier')
            ) result = '🎉 Jij wint!';
            else if(userKeuze!==botKeuze) result='😢 Bot wint!';
            await interaction.update({
                embeds:[new EmbedBuilder()
                    .setTitle('🪨📄✂️ Steen-Papier-Schaar')
                    .setDescription(`Jij koos **${userKeuze}**, bot koos **${botKeuze}**\n${result}`)
                    .setColor('Random')
                ],
                components:[]
            });
        }

        // --- HL ---
        if(id==='hl_hoger' || id==='hl_lager'){
            if(interaction.channel.id !== channels.hooglaag) return interaction.reply({ content:'❌ Dit kan hier niet gebruikt worden.', ephemeral:true });
            const nummer = highLowSessions.get(interaction.user.id);
            if(!nummer) return interaction.reply({ content:'Geen actief spel!', ephemeral:true });
            const next = Math.floor(Math.random()*100)+1;
            let win=false;
            if(id==='hl_hoger') win=next>nummer;
            else win=next<nummer;
            await interaction.update({
                embeds:[new EmbedBuilder()
                    .setTitle('⬆️⬇️ Hoog/Laag Resultaat')
                    .setDescription(`Huidig getal: **${nummer}**\nVolgend getal: **${next}**\n${win?'🎉 Jij wint!':'😢 Jij verliest!'}`)
                    .setColor(win?'Green':'Red')
                ],
                components:[]
            });
            highLowSessions.delete(interaction.user.id);
        }

        // --- Blackjack ---
        if(id==='hit' || id==='stand'){
            if(interaction.channel.id !== channels.blackjack) return interaction.reply({ content:'❌ Dit kan hier niet gebruikt worden.', ephemeral:true });
            const sessie = blackjackSessions.get(interaction.user.id);
            if(!sessie || sessie.finished) return interaction.reply({ content:'Geen actieve blackjack game!', ephemeral:true });

            if(id==='hit'){
                sessie.playerHand.push(drawCard());
                const totaal = calculateHand(sessie.playerHand);
                if(totaal>21){
                    sessie.finished=true;
                    await interaction.update({
                        embeds:[new EmbedBuilder()
                            .setTitle('🃏 Blackjack - Verloren')
                            .setDescription(`Jouw hand: ${sessie.playerHand.join(', ')} (Totaal: ${totaal})\nJe hebt meer dan 21 en verliest!`)
                            .setColor('Red')
                        ],
                        components:[]
                    });
                } else {
                    await interaction.update({
                        embeds:[new EmbedBuilder()
                            .setTitle('🃏 Blackjack')
                            .addFields(
                                { name:'Jouw hand', value:`${sessie.playerHand.join(', ')} (Totaal: ${totaal})`, inline:true },
                                { name:'Hand van dealer', value:`${sessie.dealerHand[0]}, ?`, inline:true }
                            )
                            .setColor('Random')
                            .setFooter({ text:'Klik op Hit of Stand!' })
                        ]
                    });
                }
            } else if(id==='stand'){
                sessie.finished=true;
                const playerTotal = calculateHand(sessie.playerHand);
                let dealerTotal = calculateHand(sessie.dealerHand);
                while(dealerTotal<17){ sessie.dealerHand.push(drawCard()); dealerTotal=calculateHand(sessie.dealerHand); }
                let result='';
                if(dealerTotal>21 || playerTotal>dealerTotal) result='🎉 Jij wint!';
                else if(playerTotal===dealerTotal) result='😐 Gelijkspel!';
                else result='😢 Dealer wint!';
                await interaction.update({
                    embeds:[new EmbedBuilder()
                        .setTitle('🃏 Blackjack - Resultaat')
                        .addFields(
                            { name:'Jouw hand', value:`${sessie.playerHand.join(', ')} (Totaal: ${playerTotal})`, inline:true },
                            { name:'Hand van dealer', value:`${sessie.dealerHand.join(', ')} (Totaal: ${dealerTotal})`, inline:true },
                            { name:'Resultaat', value:result }
                        )
                        .setColor('Random')
                    ],
                    components:[]
                });
            }
        }
    }

});

client.once('clientReady',()=>console.log(`Bot online als ${client.user.tag}`));

const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running ✅");
}).listen(PORT, () => {
    console.log(`Server draait op poort ${PORT}`);
});


client.login(process.env.TOKEN);



