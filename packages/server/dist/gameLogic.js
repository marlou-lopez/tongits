"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.calculatePoints = calculatePoints;
exports.isValidMeld = isValidMeld;
exports.sortMeld = sortMeld;
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
function calculatePoints(hand) {
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
