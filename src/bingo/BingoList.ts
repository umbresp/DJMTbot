// BingoPrompt - specific prompt entry + name (accepts empty) and color
export interface BingoPrompt {
    rawPrompt: string;
    name: string;
    color: string;
}

// BingoListData - Holds raw prompts and the list's properties
interface BingoListData {
    rawPrompts: string[];
    name: string;
    color: string;
}

export interface BingoList {
    min: number;
    max: number;
    dataList?: BingoListData;
    dataLists?: BingoListData[];
}

export class BingoListHelper {

    /**
     * Returns a BingoPrompt created by retrieving randomly-chosen data from passed list. Removes child list if more than 2 found and it became empty.
     * @returns BingoPrompt + index of BingoList it was retrieved from, null null on error.
     */
    static retrieveRandomPrompt(bingoList: BingoList): BingoPrompt | null
    {
        let rawPrompt: string;
        let list;
        let randomIndex = -1;
        // if only 1 type of list, use it
        if (bingoList.dataList)
        {
            list = bingoList.dataList;
        }
        // if many types of list, select one at random
        else if (bingoList.dataLists)
        {
            // (unless it has only 1 entry)
            if (bingoList.dataLists.length == 1)
            {
                list = bingoList.dataLists[0];
            }
            else
            {
                randomIndex = Math.floor(Math.random() * bingoList.dataLists.length);
                list = bingoList.dataLists[randomIndex];
            }
        }
        // should never happen
        else return null;

        if (list.rawPrompts.length === 0) return null;

        // get random raw prompt
        const index = Math.floor(Math.random() * list.rawPrompts.length);
        rawPrompt = list.rawPrompts.splice(index, 1)[0];

        const prompt: BingoPrompt = {rawPrompt: rawPrompt, name: list.name, color: list.color};

        // erase used internal list if empty after retrieving prompt
        if (randomIndex >= 0 && list.rawPrompts.length === 0)
        {
            bingoList.dataLists?.splice(randomIndex, 1);
        }

        return prompt;
    }

    /**
     * Removes BingoList from a BingoList array and returns how many rawPrompts left it had.
     * @returns uint of how many rawPrompts the removed list had, null on error.
     */
    static removeBingoListAt(bingoList: BingoList[], index: number): number | null
    {
        let promptsLeft = 0;
        if (bingoList[index].dataList)
        {
            let aux = bingoList[index].dataList;
            if (aux === undefined) return null;
            promptsLeft = aux.rawPrompts.length;
        }
        else if (bingoList[index].dataLists)
        {
            let aux = bingoList[index].dataLists;
            if (aux === undefined) return null;
            promptsLeft = aux.reduce((total, list) => total + list.rawPrompts.length, 0);
        }
        // should never happen
        else return null;

        bingoList.splice(index, 1);
        return promptsLeft;
    }

    /**
     * Clones a BingoList[], making a deepcopy only of rawPrompts.
     * @param bingoLists - Array of BingoPrompts
     * @returns Cloned BingoList array.
     */
    static cloneBingoListArray(bingoLists: BingoList[]): BingoList[]
    {
        return bingoLists.map(list => {
            if (list.dataList) {
                return {
                    ...list,
                    dataList: {
                        ...list.dataList,
                        rawPrompts: [...list.dataList.rawPrompts]
                    }
                };
            } else if (list.dataLists) {
                return {
                    ...list,
                    dataLists: list.dataLists.map(data => ({
                        ...data,
                        rawPrompts: [...data.rawPrompts]
                    }))
                };
            }
            // should never happen
            else return { ...list };
        });
    }

    /**
     * Check if object is a valid BingoList[] (checks all its entries have all required fields for BingoList).
     * @returns true if is valid BingoList[], false otherwise.
     */
    static isValidBingoListArray(arg: any): arg is BingoList[]
    {
        return Array.isArray(arg) && arg.every(item =>
            typeof item.min === 'number' &&
            typeof item.max === 'number' &&
            (
                item.dataLists === undefined &&
                item.dataList !== undefined &&
                (
                    typeof item.dataList.name === 'string' &&
                    typeof item.dataList.color === 'string' &&
                    Array.isArray(item.dataList.rawPrompts) &&
                    item.dataList.rawPrompts.every((prompts: any) => typeof prompts === 'string')
                )
            )
            ||
            (
                item.dataList === undefined &&
                item.dataLists !== undefined &&
                item.dataLists.every((list: any) =>
                    typeof list.name === 'string' &&
                    typeof list.color === 'string' &&
                    Array.isArray(list.rawPrompts) &&
                    list.rawPrompts.every((prompts: any) => typeof prompts === 'string')
                )
            )
        );
    }

    /**
     * Returns length of a given BingoList, taking into account distinction between those with 1 or multiple internal lists.
     * @param bingoList - BingoList
     * @returns N of available prompts.
     */
    static bingoListLength(bingoList: BingoList): number
    {
        if (bingoList.dataList && !bingoList.dataLists) return bingoList.dataList.rawPrompts.length;
        else if (bingoList.dataLists && !bingoList.dataList) return bingoList.dataLists.reduce((total, list) => total + list.rawPrompts.length, 0);
        else return 0; // should never happen
    }

    /**
     * Returns length of a whole BingList[], taking into account distinction between those with 1 or multiple internal lists AND max. values
     * @param bingoLists - Array of BingoPrompts
     * @returns N of available prompts.
     */
    static maxAvailablePrompts(bingoLists: BingoList[]): number
    {
        return bingoLists.reduce((total, list) => total += 
            (list.max < 0) ? this.bingoListLength(list) : (list.max == 0) ? 0 : (this.bingoListLength(list) >= list.max) ? list.max : this.bingoListLength(list), 0);
    }
}