import { Component } from "../Component";
import { AttachmentBuilder, ChatInputCommandInteraction, GuildMember, Interaction, Message, MessageReaction, PermissionFlagsBits, SlashCommandBuilder, User, VoiceState } from "discord.js";
import { ComponentCommands } from "../Constants/ComponentCommands";
import { ComponentNames } from "../Constants/ComponentNames";
import { BingoCard } from '../bingo/BingoCard';
import { BingoList, BingoListHelper } from '../bingo/BingoList';

const getBingoCommand = new SlashCommandBuilder();
const resetBingoCommand = new SlashCommandBuilder();
const getBingoConfigCommand = new SlashCommandBuilder();
const updateBingoConfigCommand = new SlashCommandBuilder();

getBingoCommand
.setName(ComponentCommands.GET_BINGO)
.setDescription("Generate bingo card image");

resetBingoCommand
.setName(ComponentCommands.RESET_BINGO)
.setDescription("Reset bingo generation limit globally")
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

getBingoConfigCommand
.setName(ComponentCommands.GET_BINGO_CONFIG)
.setDescription("Get bingo JSON")
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

updateBingoConfigCommand
.setName(ComponentCommands.UPDATE_BINGO_CONFIG)
.setDescription("Update bingo JSON - pass a .json file")
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
.addAttachmentOption(option => option
    .setName("bingo_json")
    .setDescription(".json file containing all lists that will be used for bingo card generation")
    .setRequired(true)
);

/**
 * This interface is used for getSaveData and afterLoadJSON, as it tells Typescript what data is expected to write and load.
 */
interface BingoComponentSave {
    generationsLeftPerUser: Map<string, number>;
    bingoLists: BingoList[];
}

/// TODO for a future: can be reorganized to accept multiple bingos (not only for music prompts)

/**
 * BingoComponent
 * Creates an NxN bingo card image based on a series of prompts.
 * Used for music contest - could be extended for other ends.
 * 
 * Commands:
 * GET_BINGO           - generates and sends bingo card image, as long as generation limit has not been reracched
 * RESET_BINGO         - resets bingo generation limit for all users
 * UPDATE_BINGO_CONGIF - updates bingo.json and BingoCard's bingo lists
 * GET_BINGO_CONFIG    - returns BingoCard's currently used bingo lists
 * 
 */
export class BingoComponent extends Component<BingoComponentSave> {

    name: ComponentNames = ComponentNames.BINGO;
    commands: SlashCommandBuilder[] = [getBingoCommand, resetBingoCommand, getBingoConfigCommand, updateBingoConfigCommand];
    generationsLeftPerUser: Map<string, number> = new Map();
    maxGenearations: number = 3;
    bingoCard: BingoCard = new BingoCard([], 16, 640, 4);

    async getSaveData(): Promise<BingoComponentSave> {
        return {
            generationsLeftPerUser: this.generationsLeftPerUser,
            bingoLists: this.bingoCard.getBingoLists()
        };
    }

    async afterLoadJSON(loadedObject: BingoComponentSave | undefined): Promise<void> {
        if (loadedObject)
        {
            this.generationsLeftPerUser = loadedObject.generationsLeftPerUser;
            if (loadedObject.bingoLists)
                this.bingoCard.setBingoLists(loadedObject.bingoLists);
        }
    }

    async onReady(): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onGuildMemberAdd(member: GuildMember): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onMessageCreate(args: string[], message: Message): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onMessageReactionAdd(messageReaction: MessageReaction, user: User): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onMessageReactionRemove(messageReaction: MessageReaction, user: User): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onMessageUpdate(oldMessage: Message, newMessage: Message): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onMessageCreateWithGuildPrefix(args: string[], message: Message): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
        return Promise.resolve(undefined);
    }

    async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        // restrict to specific role:
        // interaction.member && doesGuildMemberHasRole(<GuildMember>interaction.member, "Organizer")

        // instead, some commands will be shown only for users with specific permissions - PermissionFlagsBits.ManageGuild
        switch (interaction.commandName)
        {
            case getBingoCommand.name:
                await this.getBingoCmd(interaction);
                break;

            case resetBingoCommand.name:
                await this.resetBingoCmd(interaction);
                break;

            case getBingoConfigCommand.name:
                await this.getBingoConfigCmd(interaction);
                break;

            case updateBingoConfigCommand.name:
                await this.updateBingoConfigCmd(interaction);
                break;

            default:
                return Promise.resolve(undefined);
        }

        return;
    }

    private async getBingoCmd(interaction: ChatInputCommandInteraction)
    {
        if (!this.bingoCard){
            return await interaction.reply({
                content: 'Internal error - **contact staff ASAP!!**',
                ephemeral: true
            });
        } else if (this.bingoCard.getBingoLists().length === 0)
        {
            return await interaction.reply({
                content: `BingoCard has not been configured - contact staff!!`,
                ephemeral: true
            });
        }

        // Check if user can generate more bingo cards
        const userId = interaction.user.id;
        let generationsLeft = this.generationsLeftPerUser.get(userId) ?? this.maxGenearations;
        if (generationsLeft > 0){
            generationsLeft--;
            this.generationsLeftPerUser.set(userId, generationsLeft);
            const cardData = this.bingoCard.generateCardData();
            if (cardData === null)
            {
                return await interaction.reply({
                    content: `Something went wrong... oops`,
                    ephemeral: true
                });
            }
            const imageBuffer = this.bingoCard.createImage(cardData);
            return await interaction.reply({
                content: `BINGO TIME!!! (you can generate **${generationsLeft}** more cards)`,
                files: [{ attachment: imageBuffer, name: "bingo_card.png" }],
                ephemeral: true
            });
        } else {
            return await interaction.reply({
                content: (`Hey, ${interaction.user.username}, no more bingo for you! You'll have to work with what you have **:)**`),
                ephemeral: true
            });
        }
    }

    private async resetBingoCmd(interaction: ChatInputCommandInteraction)
    {
        this.generationsLeftPerUser.clear();
        return await interaction.reply({
            content: `Bingo generation limit has been reset for everyone!`,
            ephemeral: true
        });
    }

    private async updateBingoConfigCmd(interaction: ChatInputCommandInteraction)
    {
        const attachment = interaction.options.getAttachment("bingo_json", true);
        // Make sure attached file is .json
        if (!attachment || !attachment.name.endsWith('.json')) {
            return await interaction.reply({
                content: "Please upload a valid .json file!",
                ephemeral: true
            });
        } else {
            // Get and parse attached json
            const response = await fetch(attachment.url);
            if (!response.ok) {
                return await interaction.reply({
                    content: "Failed to download JSON file. No, it's not your fault... *or is it!?!*",
                    ephemeral: true
                });
            }
            const jsonContent = await response.text();
            let parsed: BingoList[];
            try {
                parsed = JSON.parse(jsonContent);
            } catch (err) {
                return await interaction.reply({
                    content: "File is not a valid JSON, check it again!",
                    ephemeral: true
                });
            }

            // Validate retrieved json as BingoList[]
            if (!BingoListHelper.isValidBingoListArray(parsed))
            {
                return await interaction.reply({
                    content: `Passed JSON doesn't have the required structure! You can use /${getBingoConfigCommand.name} to get current used JSON.`,
                    ephemeral: true
                });
            }

            // Check that object has required minimum size (order ** 2)
            if (!this.bingoCard.setBingoLists(parsed))
            {
                return await interaction.reply({
                    content: `Not enough prompts! JSON contained ${BingoListHelper.maxAvailablePrompts(parsed)}, minimum is ${this.bingoCard.getOrder() ** 2}`,
                    ephemeral: true
                });
            }
            
            // If everything went smoothly, save state
            await this.djmtGuild.saveJSON();
            return await interaction.reply({
                content: `Bingo config updated successfully! Well done!`,
                ephemeral: true
            });
        }
    }

    private async getBingoConfigCmd(interaction: ChatInputCommandInteraction)
    {
        if (!this.bingoCard){
            return await interaction.reply({
                content: 'BingoCard is not initialized - **check source code!**',
                ephemeral: true
            });
        } else if (this.bingoCard.getBingoLists().length === 0)
        {
            return await interaction.reply({
                content: `BingoCard object not initialized!!! Set a new bingo configuration.`,
                ephemeral: true
            });
        }

        // Return currently used BingoList[]
        const attachment = new AttachmentBuilder(Buffer.from(JSON.stringify(this.bingoCard.getBingoLists(), null, 2)), { name: 'bingo.json' });
        return await interaction.reply({
            content: 'Here is the current bingo configuration:',
            files: [attachment],
            ephemeral: true
        });
    }
}