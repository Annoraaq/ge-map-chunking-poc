import Phaser from "phaser";
import { Direction, GridEngine } from "grid-engine";
import { Subject, takeUntil } from "rxjs";
import { ChunkLoader } from "./ChunkLoader.js";

const CHUNK_SIZE = 10;
const CHUNKS_IN_ROW = 5;
const CHUNKS_IN_COL = 5;

export class MainScene extends Phaser.Scene {
  private ge: GridEngine;
  private playerSprite: Phaser.GameObjects.Sprite;
  private currentChunk = 1;
  private initGridEngine$ = new Subject<void>();
  private chunker = new ChunkLoader(
    this,
    CHUNK_SIZE,
    CHUNKS_IN_ROW,
    CHUNKS_IN_COL,
    1
  );

  constructor() {
    super({ key: "GameScene" });
  }

  preload(): void {
    this.load.spritesheet("player", "assets/characters.png", {
      frameWidth: 26,
      frameHeight: 36,
    });
    this.load.image("tiles", "assets/cloud_tileset.png");
  }

  async create(): Promise<void> {
    this.playerSprite = this.add.sprite(0, 0, "player");

    await this.chunker.loadNeighborChunks(this.currentChunk);
    const tilemap = await this.chunker.loadNewMap(this.currentChunk);
    this.initGridEngine(13, 13, tilemap);
    this.cameras.main.startFollow(this.playerSprite, true);
    this.cameras.main.setFollowOffset(
      -this.playerSprite.width,
      -this.playerSprite.height
    );
  }

  update(_time: number, _delta: number): void {
    const cursors = this.input.keyboard.createCursorKeys();
    if (cursors.left.isDown) {
      this.ge.move("player", Direction.LEFT);
    } else if (cursors.right.isDown) {
      this.ge.move("player", Direction.RIGHT);
    } else if (cursors.up.isDown) {
      this.ge.move("player", Direction.UP);
    } else if (cursors.down.isDown) {
      this.ge.move("player", Direction.DOWN);
    }
  }

  private initGridEngine(
    x: number,
    y: number,
    tilemap: Phaser.Tilemaps.Tilemap,
    movementProgress = 0,
    facingDirection = Direction.DOWN
  ): void {
    this.initGridEngine$.next();
    const gridEngineConfig = {
      characters: [
        {
          id: "player",
          sprite: this.playerSprite,
          walkingAnimationMapping: 6,
          startPosition: { x, y },
        },
      ],
    };

    this.ge.create(tilemap, gridEngineConfig);
    this.ge.setMovementProgress("player", movementProgress);
    this.ge.turnTowards("player", facingDirection);

    this.ge
      .positionChangeFinished()
      .pipe(takeUntil(this.initGridEngine$))
      .subscribe(async ({ enterTile }) => {
        const newChunkData = this.newChunkData(enterTile);
        if (newChunkData) {
          this.currentChunk = newChunkData.newCurrentChunk;
          const newTilemap = await this.chunker.loadNewMap(this.currentChunk);
          this.deleteTilemap(tilemap);
          this.initGridEngine(
            newChunkData.newXPos,
            newChunkData.newYPos,
            newTilemap,
            this.ge.getMovementProgress("player"),
            this.ge.getFacingDirection("player")
          );
        }
      });
  }

  private newChunkData(enterTile: {
    x: number;
    y: number;
  }):
    | { newCurrentChunk: number; newXPos: number; newYPos: number }
    | undefined {
    // leave right
    if (enterTile.x == CHUNK_SIZE * 2) {
      const isRightBorder = (this.currentChunk + 1) % CHUNKS_IN_ROW == 0;
      if (isRightBorder) return;
      return {
        newCurrentChunk: this.currentChunk + 1,
        newXPos: CHUNK_SIZE,
        newYPos: enterTile.y,
      };
      // leave left
    } else if (enterTile.x === CHUNK_SIZE - 1) {
      const isLeftBorder = this.currentChunk % CHUNKS_IN_ROW == 0;
      if (isLeftBorder) return;
      return {
        newCurrentChunk: this.currentChunk - 1,
        newXPos: 2 * CHUNK_SIZE - 1,
        newYPos: enterTile.y,
      };
      // leave down
    } else if (enterTile.y === CHUNK_SIZE * 2) {
      const isBottomBorder =
        this.currentChunk + CHUNKS_IN_ROW >= CHUNKS_IN_COL * CHUNKS_IN_ROW;
      if (isBottomBorder) return;
      return {
        newCurrentChunk: this.currentChunk + CHUNKS_IN_ROW,
        newXPos: enterTile.x,
        newYPos: CHUNK_SIZE,
      };
      // leave up
    } else if (enterTile.y === CHUNK_SIZE - 1) {
      const isTopBorder = this.currentChunk - CHUNKS_IN_ROW < 0;
      if (isTopBorder) return;
      return {
        newCurrentChunk: this.currentChunk - CHUNKS_IN_ROW,
        newXPos: enterTile.x,
        newYPos: 2 * CHUNK_SIZE - 1,
      };
    }
  }

  private deleteTilemap(tilemap: Phaser.Tilemaps.Tilemap): void {
    const lays = tilemap ? [...tilemap.layers] : [];
    for (const lay of lays) {
      lay.tilemapLayer.destroy();
    }
  }
}
