package deck

import (
	"crypto/rand"
	"fmt"
	"math/big"

	"github.com/sras1599/wordit/backend/internal/room"
)

// letterFrequency is a standard English letter tile distribution (Scrabble-style, 98 tiles).
var letterFrequency = map[string]int{
	"A": 9, "B": 2, "C": 2, "D": 4, "E": 12,
	"F": 2, "G": 3, "H": 2, "I": 9, "J": 1,
	"K": 1, "L": 4, "M": 2, "N": 6, "O": 8,
	"P": 2, "Q": 1, "R": 6, "S": 4, "T": 6,
	"U": 4, "V": 2, "W": 2, "X": 1, "Y": 2,
	"Z": 1,
}

// New returns a freshly shuffled deck of letter cards.
func New() ([]room.Card, error) {
	var cards []room.Card
	idx := 0
	for letter, count := range letterFrequency {
		for range count {
			cards = append(cards, room.Card{
				ID:     fmt.Sprintf("card_%03d", idx),
				Letter: letter,
			})
			idx++
		}
	}
	if err := shuffle(cards); err != nil {
		return nil, err
	}
	return cards, nil
}

// shuffle applies a cryptographically random Fisher-Yates shuffle.
func shuffle(cards []room.Card) error {
	for i := len(cards) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := n.Int64()
		cards[i], cards[j] = cards[j], cards[i]
	}
	return nil
}
