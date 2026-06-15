# Game Mechanic Brief

## Core Foundation

- **Convention** = money generation
- **Shop** = card generation
- **Collection** (Single UI for binder + Display Case) = optimization/meta progression

### Locked Terms

A **set** of cards is like 30 cards with a common theme, and some common, rare, epic, and one or two "chase" per set. Sets unlock throughout.

**Stock:** Whenever you gain cards, they are added to your "stock" by rarity and holo/non-holo. So we really don't care about what cards you open except when putting the collection — collections will care about the actual card and rarity, but when the booth is selling your cards, we just treat all cards of similar rarity and holo the same. Meaning we have 7 total "piles" (uncommon can't be holo) with different worth, and NPCs will have likelihood of buying of certain piles. So normal NPCs will not buy legendary cards for example, and only low chance of holo for example — but then some NPCs that can spawn will have high chance of buying your legendary cards. That way the NPC spawn also becomes exciting: "oh look, I get the whale-dude, perfect!"

---

## Convention

Passive money income.

1. Visitors arrive.
2. They buy cards.
3. You earn money.

When NPCs buys cards, they do a small emote in a speec bubble above thier head, like a heart or a smiley or something. 

**Sometimes:**

A trade offer appears. It's like a quest — a trade offer would be like "I want a specific card in holo" and you can complete it once you obtain that card.

Convention should mostly run itself.

The fun is seeing the booth alive.

---

## Trade Offer — What Is That?!

It's like a quest. A player arrives at your booth, standing on the opposite side of you. A **?** appears above; you click and it displays a task in pictogram, for example:

- `1x [specific card]`
- `5x [rare][holo]`

It outlines **green** if you can complete it, or outlines **grey** if you cannot. Clicking it when you can complete it completes it and reward is given.

### Unlocks (progression)

Trade offers are the main progression gate. Completing certain trade offers unlocks a
**new convention**, and every new convention that unlocks also unlocks a **new set** of cards.
So conventions and sets unlock together, driven by completing trades — that's how the game
opens up over time.

Btw, we can never consume a card from the binder, right? So trades are actually "Have you discovered Fire Dragon" and NOT "do you have it right now" — unless of course the trade offer is "I want two Chase cards."

### Resources


| Resource       | Description                                     |
| -------------- | ----------------------------------------------- |
| **Money**      | Used to buy packs and vending machine stuff.    |
| **Collection** | Permanent discoveries. Never lost.              |
| **Stock**      | Economic fuel from packs that visitors consume. |


---

## Shop

Actively open packs.

1. **Buy pack**
2. **Rip pack(s)** — interaction-wise I'm thinking like clicking the packs makes the cards pop out
3. Card flies out on the floor — face-down but with rarity-glow around
4. Player clicks (or can hold mouse to hover a lot and pickup a lot at the same time)
5. Cards animate-reveal and new ones get a "first!" and holo gets a "holo!"
6. Cards are added to collection if they are not already (already existing but you got holo, gets holo-fied in the collection UI) and are also added to the stock — and again, when they go into the stock only rarity + holo counts.

---

## Collection

As I said: a combination of a **Binder** that displays all sets and ever-seen cards and a **Display Case** that boosts your convention. It's kinda a skill system. So far I'm thinking of these four skills as the core:


| Skill           | Effect                                                          |
| --------------- | --------------------------------------------------------------- |
| **+Reputation** | More money per sell                                             |
| **+Luck**       | Better rarity when opening packs                                |
| **+Prestige**   | Rare visitor chance, higher chance of NPC spawns a rare visitor |
| **+Attraction** | Faster spawn time for convention visitors                       |


### Binder

Displays one set per page, and gives bonus based on completion. All the bonus is in 5 tiers, per set, and each tier is unlocked by:

- All common grants 1 tier
- All rare grants 1 tier
- All epic grants 1 tier
- All Chase grants 1 tier
- All holo grants 1 tier

The bonus for the set is then just displayed as "+1/3/6/10/15 prestige", right. Make sense? Yes. Good.

### Display Case

Three slots. Clicking a card in the collection **Binder** will add it to an empty display case. (And clicking an occupied display case will remove the card from that, making it empty to fill up — that's how we solve that interaction to be super simple and clicking.)

The cards show their bonuses once in the case, and there are also combos to be discovered, but they are "hidden" so to speak. Like, they only display once they activate.

---

## Stations

### Booth

When on the booth:

- Displays stats / current prices for each "pile" in the stock
- Displays the stock
- Increased Attraction (+20%) while standing there (so when players AFK they still feel like its worth begin at a certain station)

Main thing though: when going to the booth, you "collect" the money from all sales. They can pile up over there and you go to collect, or you can stand there to have them instantly arrive in your bank. Visitors buy cards regardless of if you are there or not; money accumulates in a cash box. When you arrive at the booth:

```
12 sales!
+€127
+3 Reputation
```

Maybe coins or cash fly toward the player or the bank-UI. Very satisfying.

### Vending Machine

Rotating inventory the user can buy. Three options — they can only choose one per rotation, and rotation changes every 15 minutes or so. (This is genius tbh — keeps players coming back to the game every 15 mins + adds choices to an otherwise pretty choice-less game.)

Purchases can be permanent, short-time boosts, or buying stuff at a discount.

**Example purchases:**

- +20% visit speed for 10 minutes
- Bulk of 100 common cards for 50% price
- 3 packs at 50% price
- Doubled sales prices for 10 minutes
- Chase Holo card for 50% price
- +X in a stat permanently
- Clicks count double for 10 minutes

### Shop Counter

- Pack buying (selectable by set and increase quantity for bulk-buy)
- Pack opening

### Arcade Machine

**NOT A MINIGAME!** It's where we see our total stats (including sources) and achievements — sort of the "meta-game" info over here.