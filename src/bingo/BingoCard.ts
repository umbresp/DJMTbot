import { createCanvas, CanvasRenderingContext2D, ImageData  } from "canvas";
import { BingoList, BingoPrompt, BingoListHelper } from "./BingoList";
import { shuffleArray } from '../HelperFunctions';

/// BingoCard - represents a bingo card with a grid-like layout of specified size and order
export class BingoCard {
    // Lists from where prompts will be chosen
    private bingoLists: BingoList[];
    // Size of bingo card in px
    private cardSize: number;
    // Grid dimensions (e.g. 3x3). Accepted values: 3, 4, 5
    private order: number;
    // Size of each tile - created from cardSize and order
    private tileSize: number;
    // Horizontal inner padding on each tile
    private hPad: number;
    // Extra vertical distance between each line of text on a same tile
    private vLineDistance: number;
    // Size for custom font
    private fontSize: number;
    // Font's line height in px - used to center text
    private lineHeight: number = 0;
    // Base card's image (white bg, grid)
    private baseCardImageData: ImageData;

    constructor(bingoLists: BingoList[], fontSize: number, cardSize: number = 640, order: number = 4, hPad: number = 8, vLineDistance: number = 10) {
        this.bingoLists = bingoLists;
        this.cardSize = cardSize;
        this.order = Math.min(Math.max(order, 3), 5);
        this.tileSize = this.cardSize / this.order;
        this.hPad = hPad;
        this.vLineDistance = vLineDistance;
        this.fontSize = fontSize;
        this.baseCardImageData = this._prepareBaseImage();
    }

    /// Getters / setters
    getBingoLists(): BingoList[] {
        return this.bingoLists;
    }

    setBingoLists(lists: BingoList[]): boolean {
        if (BingoListHelper.maxAvailablePrompts(lists) >= this.order ** 2)
        {
            this.bingoLists = lists;
            return true;
        }
        return false;
    }

    getOrder(): number {
        return this.order;
    }

    /**
     * Generates an array of BingoPrompts to be used for the Bingo card.
     * @returns A shuffled array of selected Bingo prompts.
     */
    generateCardData(): BingoPrompt[] | null {
        const selectedTiles: BingoPrompt[] = [];
        let listPool: {list: BingoList, usesLeft: number}[] = [];
        let bingoLists = BingoListHelper.cloneBingoListArray(this.bingoLists);
        let n = this.order;
        let maxN = 0;

        for (let i = 0; i < bingoLists.length; i++) {
            const bList = bingoLists[i];
            let maxToAdd = bList.max;
            // Case: lists that 100% NEED te appear X times on the final card
            if (bList.min > 0) {
                let to_add = bList.min;
                while (to_add > 0) {
                    let prompt = BingoListHelper.retrieveRandomPrompt(bList);
                    if (prompt === null) {
                        to_add = 0;
                        continue;
                    }
                    selectedTiles.push(prompt);
                    to_add--;
                }
                // After adding required prompts, might still want to have the possibility to add even more prompts from here
                if (bList.min >= bList.max) {
                    continue;
                }
                maxToAdd = bList.max - bList.min;
            }

            // Filter unwanted fields (e.g. last minute decision to restrict specific entry but don't want to erase it)
            if (bList.max == 0)
                continue;

            maxN += BingoListHelper.bingoListLength(bList);
            listPool.push({list: bList, usesLeft: maxToAdd});
        }

        let toAdd = n ** 2 - selectedTiles.length;
        while (toAdd > 0) {
            let retrieved = this._getRandomPromptFromLists(listPool, maxN);
            if (retrieved === null)
                return null;
            selectedTiles.push(retrieved.prompt);
            maxN = retrieved.maxN;
            toAdd--;
        }

        shuffleArray(selectedTiles);
        return selectedTiles;
    }

    /**
     * Creates an image representing a bingo card.
     * @param cardData - Array of BingoPrompts to fill the card.
     * @returns A buffer containing the generated image.
     */
    createImage(cardData: BingoPrompt[]): Buffer
    {
        let canvas = createCanvas(this.cardSize, this.cardSize);
        let ctx = canvas.getContext("2d");
        ctx.textAlign = "center";
        ctx.font = `${this.fontSize}px`
        ctx.putImageData(this.baseCardImageData, 0, 0)
        ctx.lineWidth = 1;
        const n = this.order;
 
        // Draw tiles
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                const x0 = col * this.tileSize;
                const y0 = row * this.tileSize;

                // Add list name (if any) to text
                const bingoPrompt: BingoPrompt = cardData[col + row * n];
                let text = bingoPrompt.name ? `${bingoPrompt.name}: ` : "";
                text += bingoPrompt.rawPrompt;

                // Draw text inside tile
                this._drawTextInTile(ctx, text, bingoPrompt.color, x0, y0);
            }
        }
 
        return ctx.canvas.toBuffer();
    }

    /// Treats all lists from pool list as 1 only array, retrieves 1 prompt at random, remove lists from pool when emptied
    private _getRandomPromptFromLists(listPool: {list: BingoList, usesLeft: number}[], maxN: number): {prompt: BingoPrompt, maxN: number} | null
    {
        // Choose random list
        let randomIndex = Math.floor(Math.random() * maxN);
        let index: number = -1;
        let aux = 0;
        for (let i = 0; i < listPool.length; i++) {
            let length = BingoListHelper.bingoListLength(listPool[i].list);
            aux += length;
            if (aux >= randomIndex)
            {
                index = i;
                break;
            }
        }

        // Choose random prompt from list
        let prompt = BingoListHelper.retrieveRandomPrompt(listPool[index].list)
        if (prompt === null) return null;

        // 1 less entry on pool
        maxN -= 1;
        listPool[index].usesLeft -= 1;

        // Purge list if emptied / reached max prompts on card
        const currLen = BingoListHelper.bingoListLength(listPool[index].list);
        if (currLen === 0 || listPool[index].usesLeft == 0) {
            maxN -= currLen;
            listPool.splice(index, 1);
        }

        return {prompt, maxN};
    }

    private _drawTextInTile(ctx: CanvasRenderingContext2D, text: string, color: string, x0: number, y0: number) {
        ctx.fillStyle = color;
        let wrappedText: string[] = [];

        // Text wrapping logic
        const maxWidth = this.tileSize - this.hPad;
        const words = text.split(" ");
        let line = words[0];
        let lineWidth = ctx.measureText(line).width;
        const spaceWidth = ctx.measureText(" ").width;

        // Create paragraph by provided text + available space (does NOT currently support dynamic text size adjustment, so make sure long texts won't look bad)
        for (let i = 1; i < words.length; i++)
        {
            let wordLength = ctx.measureText(words[i]).width;
            lineWidth += spaceWidth + wordLength;
            if (lineWidth > maxWidth)
            {
                wrappedText.push(line);
                line = words[i];
                lineWidth = wordLength;
            }
            else
                line += " " + words[i];
        }
        wrappedText.push(line);

        let totalTextHeight = wrappedText.length * this.lineHeight + (wrappedText.length - 1) * this.vLineDistance;
        // Starts on baseline
        let drawY = y0 + this.lineHeight + 0.5 * (this.tileSize - totalTextHeight);
        // Draw text line by line
        for (let line of wrappedText) {
            ctx.fillText(line, x0 + this.tileSize / 2, drawY);
            drawY += this.lineHeight + this.vLineDistance;
        }
    }

    /// Grid-like image
    private _prepareBaseImage(): ImageData
    {
        let canvas = createCanvas(this.cardSize, this.cardSize);
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.cardSize, this.cardSize);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;

        // Draw tiles' borders
        for (let i = 1; i < this.order; i++)
        {
            let lineCenter = i * this.tileSize;
            ctx.strokeRect(lineCenter - 1, 0, 1, this.cardSize);
            ctx.strokeRect(0, lineCenter - 1, this.cardSize, 1);
        }
        // Set actual line height
        let textMetrics = ctx.measureText("Mg");
        this.lineHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}