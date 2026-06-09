# Arcade World: Student-Friendly Explanation

Arcade World is a shared online arcade space for classmates.

## What you can do today

- Join the same lobby as other players during a PlayCanvas multiplayer playtest.
- Choose a display name, body color, and hat before entering.
- Walk, look around, sprint, and jump.
- See other players moving around with their names and avatar choices.
- Play a Manhunt-style round: gather at Home Base, start with **M**, and tag as a seeker with **E**.
- Collect prototype tickets in free roam when the ticket setup is enabled.

There is also a static local prototype that developers can run without the multiplayer server. That version uses a mock remote player so code can be tested quickly.

## How multiplayer works

1. Your browser connects to the game server.
2. Your browser sends your position and profile choices to the server.
3. The server shares player, Manhunt, and ticket state with everyone in the room.
4. Each browser draws the other players and updates the UI.

## Why some parts are prototypes

The team is building in slices. The most important systems first are:

- shared lobby presence,
- simple safe movement,
- classroom-friendly Manhunt rules,
- and a first ticket pickup loop.

## Coming later

- More arcade machines and real mini-game handoffs.
- A shop where tickets can buy cosmetics.
- Private classroom room codes and moderation tools.
- More polished avatars, art, and sound.
