"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.sumPoints = sumPoints;
exports.isValidMeld = isValidMeld;
exports.sortMeld = sortMeld;
exports.findAllPossibleMelds = findAllPossibleMelds;
exports.findMinPoints = findMinPoints;
exports.calculatePoints = calculatePoints;
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            let value = parseInt(rank);
            if (rank === 'A')
                value = 1;
            if (['10', 'J', 'Q', 'K'].includes(rank))
                value = 10;
            deck.push({
                id: `${suit}-${rank}`,
                suit,
                rank,
                value
            });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}
function sumPoints(hand) {
    return hand.reduce((total, card) => total + card.value, 0);
}
// Utility to get numerical rank for straight checks
function getRankNum(rank) {
    if (rank === 'A')
        return 1;
    if (rank === 'J')
        return 11;
    if (rank === 'Q')
        return 12;
    if (rank === 'K')
        return 13;
    return parseInt(rank);
}
function isValidMeld(cards) {
    if (cards.length < 3)
        return false;
    // Check 1: Same Rank (e.g., 3 of Hearts, 3 of Spades, 3 of Clubs)
    const allSameRank = cards.every(c => c.rank === cards[0].rank);
    if (allSameRank)
        return true;
    // Check 2: Straight Flush
    const allSameSuit = cards.every(c => c.suit === cards[0].suit);
    if (!allSameSuit)
        return false;
    // Sort by rank to check if consecutive
    const sorted = [...cards].sort((a, b) => getRankNum(a.rank) - getRankNum(b.rank));
    for (let i = 1; i < sorted.length; i++) {
        if (getRankNum(sorted[i].rank) !== getRankNum(sorted[i - 1].rank) + 1) {
            return false;
        }
    }
    return true;
}
function sortMeld(cards) {
    return [...cards].sort((a, b) => {
        const rankDiff = getRankNum(a.rank) - getRankNum(b.rank);
        if (rankDiff !== 0)
            return rankDiff;
        return a.suit.localeCompare(b.suit);
    });
}
function getCombinations(array, size) {
    const result = [];
    function combine(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < array.length; i++) {
            combo.push(array[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }
    combine(0, []);
    return result;
}
function findAllPossibleMelds(hand) {
    const melds = [];
    // 1. Sets (3 or 4 of a kind)
    const byRank = {};
    for (const card of hand) {
        if (!byRank[card.rank])
            byRank[card.rank] = [];
        byRank[card.rank].push(card);
    }
    for (const rank in byRank) {
        const cards = byRank[rank];
        if (cards.length >= 3) {
            melds.push(...getCombinations(cards, 3));
            if (cards.length === 4) {
                melds.push([...cards]);
            }
        }
    }
    // 2. Runs (Straight Flushes)
    const bySuit = {};
    for (const card of hand) {
        if (!bySuit[card.suit])
            bySuit[card.suit] = [];
        bySuit[card.suit].push(card);
    }
    for (const suit in bySuit) {
        const cards = bySuit[suit];
        cards.sort((a, b) => getRankNum(a.rank) - getRankNum(b.rank));
        for (let i = 0; i < cards.length; i++) {
            for (let j = i + 2; j < cards.length; j++) {
                const sub = cards.slice(i, j + 1);
                if (isValidMeld(sub)) {
                    melds.push(sub);
                }
            }
        }
    }
    return melds;
}
function findMinPoints(hand) {
    const possibleMelds = findAllPossibleMelds(hand);
    let minPoints = sumPoints(hand);
    for (const meld of possibleMelds) {
        const remainingHand = [...hand];
        let canRemove = true;
        for (const card of meld) {
            const idx = remainingHand.findIndex(c => c.id === card.id);
            if (idx !== -1) {
                remainingHand.splice(idx, 1);
            }
            else {
                canRemove = false;
                break;
            }
        }
        if (canRemove) {
            const points = findMinPoints(remainingHand);
            if (points < minPoints) {
                minPoints = points;
            }
        }
    }
    return minPoints;
}
function calculatePoints(hand) {
    return findMinPoints(hand);
}
