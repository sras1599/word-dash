# Changelog

## [1.2.0](https://github.com/sras1599/word-dash/compare/v1.1.0...v1.2.0) (2026-07-21)


### Features

* **ui:** complete layout redesign on game page ([9e8d394](https://github.com/sras1599/word-dash/commit/9e8d3942556756acd292cce2449cd473ee7e5ef9))

## [1.1.0](https://github.com/sras1599/word-dash/compare/v1.0.0...v1.1.0) (2026-07-20)


### Features

* **backend:** add board reconciliation metadata ([319267f](https://github.com/sras1599/word-dash/commit/319267ff8ae3be5be87ebbc449119bad75da47ac))
* **frontend:** reconcile optimistic board actions ([4d9732b](https://github.com/sras1599/word-dash/commit/4d9732b497e3a88dc83f8e57b6d15e0143d7e4f6))

## 1.0.0 (2026-07-13)


### Features

* add ability for player to mark themselves as not ready, and update UI when a player is disconnected ([0437cc9](https://github.com/sras1599/word-dash/commit/0437cc97d4baee54be21c39c949b208b14720e38))
* add deployment manifests ([0479cd6](https://github.com/sras1599/word-dash/commit/0479cd61b0ab553afda2c624e532b950424aa4ea))
* add docker-compose with definition for redis container ([267934a](https://github.com/sras1599/word-dash/commit/267934a1cf6ddb31a1de8fd657f12067d35696ef))
* allow a player to rearrange cards on the boards and discard card from the board ([0ae35ec](https://github.com/sras1599/word-dash/commit/0ae35ec2bed50f9388ea1a584ea72e6f89ed4887))
* allow cards to be swapped between words, and between the hand and the board ([4980e84](https://github.com/sras1599/word-dash/commit/4980e84f7d8b0760df9a86611c71f442dc92cb17))
* allow player to be not ready and handle player disconnects ([0cffdd5](https://github.com/sras1599/word-dash/commit/0cffdd53e26ca164dd7482a9d509425321fd0c93))
* allow word row and word board to be cleared by buttons ([4404e92](https://github.com/sras1599/word-dash/commit/4404e9217c69fda0ae8b971916112b6c3d5b0041))
* auto discard the drawn card from a player's hand if they have not discarded any other card in their turn ([4283c0e](https://github.com/sras1599/word-dash/commit/4283c0e5dd8bee464e2d783629790978b56dab98))
* handle client ws event game:place_card ([caa6fb7](https://github.com/sras1599/word-dash/commit/caa6fb7238b9357085a8fbc14cf7879489b00afa))
* implement file dictionary ([bfa0f09](https://github.com/sras1599/word-dash/commit/bfa0f097cdec137154ef34413bd573d0bb3b1814))
* implement redis store ([c5ada1a](https://github.com/sras1599/word-dash/commit/c5ada1aa535911390a6ae9a34ed433757f3809eb))
* implement turn timer and make it a configurable parameter, along with default word length ([1fbeee4](https://github.com/sras1599/word-dash/commit/1fbeee424782ada2ed6ac219c8abb7b67f07e901))
* implement win check ([cd6789e](https://github.com/sras1599/word-dash/commit/cd6789ece87b03f53ecc0ac33f1b0b09f76e4c93))
* improve keyboard play by allowing left/right arrow keys to work in the hand as well ([64b43c2](https://github.com/sras1599/word-dash/commit/64b43c2cd9512f6fc19ac0e0d2c6455e2005ca7c))
* keyboard shortcuts ([1188fbf](https://github.com/sras1599/word-dash/commit/1188fbf6bfb04260bb114351a98ce06854024d09))
* local optimistic updates ([c863841](https://github.com/sras1599/word-dash/commit/c863841ce9d01cff390304338e99e30b0a0c6eea))
* make the card slot the same shape as the card ([2ba7945](https://github.com/sras1599/word-dash/commit/2ba7945235941470d4c0d941f7a68e9b6ce1a26d))
* more keyboard controls and subtle UI feedbacks when a card is active ([1667de6](https://github.com/sras1599/word-dash/commit/1667de6d25cc2e2ed36f51d2e115442e3e7cff6c))
* scaffold server related backend logic ([19b86c6](https://github.com/sras1599/word-dash/commit/19b86c6388260817b725a5ee95c8530050aba15e))
* update game settings UI in lobby and add support for configuring turn length ([a7a4207](https://github.com/sras1599/word-dash/commit/a7a42078cff816d1002e8457ad152cce6e06a8ad))
* update game:unplace_card condition and add backend implementation for it ([72e91c1](https://github.com/sras1599/word-dash/commit/72e91c1bc28ef18fc14e5a19ba2fc45d959b7018))
* update turn timer implementation ([3f63769](https://github.com/sras1599/word-dash/commit/3f63769432b0b34344da22e90ec0ca78c196f524))


### Bug Fixes

* add nginx.conf for frontend docker deployment ([764d3b4](https://github.com/sras1599/word-dash/commit/764d3b4bb3aea6442814ef276b5119f7b5bc6e2e))
* allow all players to place cards on the word board, irrespective of their turn ([a062b16](https://github.com/sras1599/word-dash/commit/a062b167ad90c402de5fc14f2612c4c4e4be0549))
* always broadcast the game:player_reconnected event when a player rejoins the game ([d4db85c](https://github.com/sras1599/word-dash/commit/d4db85ce50f151b5596979167a462e499596a789))
* do not create word boards until the room creator starts a game ([01cbd65](https://github.com/sras1599/word-dash/commit/01cbd65d247386cf5698799372d58b99ff7f0212))
* don't delete lobby immediately after a player disconnects. Wait 15 minutes ([86dcddf](https://github.com/sras1599/word-dash/commit/86dcddf39789955d097f637b8cc6a470d24c3498))
* fix issue with room creation logic where variation info sent from the frontend was being ignored by the backend ([e76694c](https://github.com/sras1599/word-dash/commit/e76694c910d1fab59aa813b94f86a233b32dd9c6))
* flash auto-discard candidate in the word board as well and don't reset turn timer in arrange phase ([6e7ccb6](https://github.com/sras1599/word-dash/commit/6e7ccb69ea2bfaebed49c1d497e7b3c92f71a8be))
* preserve card updates when using the redis store ([1859abe](https://github.com/sras1599/word-dash/commit/1859abefeeac2f1b131e09b3b44f79f9437aa765))
* unplace card should be allowed when its not a player's turn ([ddc8d4b](https://github.com/sras1599/word-dash/commit/ddc8d4b0bf28a6162dcef82f8a584e9279393357))
* use the same turn timer for the draw and arrange phase ([e4cd520](https://github.com/sras1599/word-dash/commit/e4cd52018a77910432e0c87c59e305e19fa45ddb))

## Changelog

Notable changes to Word Dash will be recorded here by Release Please.
