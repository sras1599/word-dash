## WordIt! Internal Documentation

These are internal docs for the game. I use them to think out loud and feed information to an AI agent so that it might automate some of the boring work for me.

### What is WordIt!
It is a popular vocabulary card game for kids. The game has 3 variants, but we'll be focusing on just one variant — Word. Set. Go.

When you purchase this game, you get a deck of cards where each card represents a letter in the english alphabet. There are 72 cards but the frequency of each letter is unknown. The vowels, however, have a much higher frequency than consonants, naturally.

#### How to play Word. Set. Go.
In this variant, the goal is to create words of varying length as fast as possible. The first one to create these words wins

###### Setup
- Decide how many words are to be made and of what length. For ex. the game's documentation shows the 3, 4, 5 variation where a player has to make 3 words of length 3, 4, and 5 to win.
- Shuffle the cards
- Based on the word length and the number of words, distribute cards to each player accordingly. If we were playing the 3, 4, 5 variation, we would've distributed 12 cards to each player.
- From the deck of remaining cards, take the top card out and put it face up to the side of this deck. This will create the _discard pile_
- Let the remaining deck be placed face down. This will create the _draw pile_
- The game starts with the person to the left of the dealer.

###### Turns
A turn lasts for a limited time and gives the player some advantages which can help them win the game. In their turn, a player can temporarily hold an extra card by either drawing one from the _draw pile_ or the _discard pile_. Note that from either of these piles, only the top most card can be drawn.

A turn has three phases:

1. **Draw phase** — The player draws the top card from either the draw pile or the discard pile. They now temporarily hold one more card than their target hand size (e.g. 13 cards in the 3, 4, 5 variation).
2. **Arrange phase** — The same turn timer continues from the draw phase. The player may rearrange their cards freely, trying to form all required words with their new hand.
3. **Swap phase** — Before the timer expires, the player must discard exactly one card from their hand. This brings them back to their normal hand size. They can discard the card they just drew (effectively passing) or any other card. If the timer expires before the player swaps, the game automatically discards the card drawn that turn.

After the swap phase, the turn passes clockwise to the next player.

###### Win Condition
A player wins the moment they have arranged **all required words simultaneously** — every word slot filled, and every word validated as a real word by the dictionary. The win is checked at the end of the swap phase (when the player returns to their normal hand size). There is no partial-win; all words must be complete at the same time.

If the draw pile is exhausted, the discard pile is reshuffled to form a new draw pile.
