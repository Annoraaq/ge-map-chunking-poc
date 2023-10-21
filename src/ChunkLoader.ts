type Directions =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

type Chunks = {
  [key in Directions]: number;
};

interface Tilemap {
  width: number;
  height: number;
  layers: TilemapLayer[];
}

interface TilemapLayer {
  width: number;
  height: number;
  data: number[];
}

export class ChunkLoader {
  private currentChunk: number;

  constructor(
    private scene: Phaser.Scene,
    private chunkSize: number,
    private chunksInRow: number,
    private chunksInCol: number,
    startChunk = 0
  ) {
    this.currentChunk = startChunk;
  }

  async loadNeighborChunks(chunkId: number): Promise<unknown> {
    const neighboringIds = Object.values(this.getNeighboringChunks(chunkId));
    let neighborsNeighborsIds = [...neighboringIds];
    for (const cid of neighboringIds) {
      neighborsNeighborsIds = [
        ...neighborsNeighborsIds,
        ...Object.values(this.getNeighboringChunks(cid)),
      ];
    }
    const validIds = neighborsNeighborsIds.filter((v) => v >= 0);
    for (const id of validIds) {
      this.scene.load.json(
        `cloud-city-map-${id}`,
        `assets/cloud_city_large-${id}.json`
      );
    }
    const prom = new Promise((resolve) =>
      this.scene.load.once("complete", resolve, this)
    );
    this.scene.load.start();
    return prom;
  }

  async loadNewMap(chunkId: number): Promise<Phaser.Tilemaps.Tilemap> {
    await this.loadTilemap(
      this.createNewMapForChunk(chunkId),
      `assembled-${chunkId}`
    );

    const tilemap = this.scene.make.tilemap({ key: `assembled-${chunkId}` });
    tilemap.addTilesetImage("cloud_tileset", "tiles");
    for (let i = 0; i < tilemap.layers.length; i++) {
      tilemap.createLayer(i, "cloud_tileset", 0, 0);
    }
    this.loadNeighborChunks(chunkId);
    return tilemap;
  }

  private createNewMapForChunk(chunkId: number): Tilemap {
    const chunkData = this.createChunkData(chunkId);
    const map = this.loadChunkFromCache(chunkId);

    const loadedChunksTotalSize = 3 * this.chunkSize;

    map.width = loadedChunksTotalSize;
    map.height = loadedChunksTotalSize;
    for (let l = 0; l < map.layers.length; l++) {
      map.layers[l].data = chunkData[l];
      map.layers[l].width = map.width;
      map.layers[l].height = map.height;
    }
    return map;
  }

  private createEmptyChunk(): Tilemap {
    const prototype = this.loadChunkFromCache(0);

    for (const l of prototype.layers) {
      l.data = [];
      for (let r = 0; r < l.height; r++) {
        for (let c = 0; c < l.width; c++) {
          l.data.push(0);
        }
      }
    }

    return prototype;
  }

  private loadChunkFromCache(chunkId): Tilemap {
    return JSON.parse(
      JSON.stringify(this.scene.cache.json.get(`cloud-city-map-${chunkId}`))
    );
  }

  private createChunkData(chunkId: number): number[][] {
    const chunkIds = this.getNeighboringChunks(chunkId);
    const chunks: { [Property in keyof Chunks]?: Tilemap } = {};
    for (const [direction, cid] of Object.entries(chunkIds) as [
      string,
      number
    ][]) {
      if (cid == -1) {
        chunks[direction] = this.createEmptyChunk();
      } else {
        chunks[direction] = this.loadChunkFromCache(cid);
      }
    }

    const current: number[][][] = this.loadChunkFromCache(chunkId).layers.map(
      (l) => this.chunkArr(l.data, this.chunkSize)
    );

    const chunkLayers: {
      [Property in keyof Chunks]?: number[][][];
    } = {};
    for (const [key, val] of Object.entries(chunks) as [
      string,
      Tilemap | undefined
    ][]) {
      chunkLayers[key] = val.layers.map((l) =>
        this.chunkArr(l.data, this.chunkSize)
      );
    }

    const {
      left,
      right,
      top,
      bottom,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    } = chunkLayers;

    const r1 = this.rightStitch(this.rightStitch(topLeft, top), topRight);
    const r2 = this.rightStitch(this.rightStitch(left, current), right);
    const r3 = this.rightStitch(
      this.rightStitch(bottomLeft, bottom),
      bottomRight
    );
    return this.bottomStitch(this.bottomStitch(r1, r2), r3).map((l) =>
      l.flat()
    );
  }

  private rightStitch(left: number[][][], right: number[][][]): number[][][] {
    const layers = [];
    for (let l = 0; l < left.length; l++) {
      const layerData = [];
      for (let r = 0; r < left[l].length; r++) {
        layerData.push([...left[l][r], ...right[l][r]]);
      }
      layers.push(layerData);
    }
    return layers;
  }

  private bottomStitch(top: number[][][], bottom: number[][][]): number[][][] {
    const layers = [];
    for (let l = 0; l < top.length; l++) {
      layers.push([...top[l], ...bottom[l]]);
    }
    return layers;
  }

  private chunkArr<T>(arr: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async loadTilemap(rawTm: Tilemap, name: string): Promise<unknown> {
    const prom = new Promise((resolve) =>
      this.scene.load.once("complete", resolve, this)
    );
    this.scene.load.tilemapTiledJSON(name, rawTm);
    this.scene.load.start();
    return prom;
  }

  private getNeighboringChunks(chunkId: number): Chunks {
    const isLeftBorder = chunkId % this.chunksInRow === 0;
    const isRightBorder = (chunkId + 1) % this.chunksInRow === 0;
    const isTopBorder = chunkId - this.chunksInRow < 0;
    const isBottomBorder =
      chunkId + this.chunksInRow > this.chunksInRow * this.chunksInCol - 1;

    const left = isLeftBorder ? -1 : chunkId - 1;
    const right = isRightBorder ? -1 : chunkId + 1;
    const top = isTopBorder ? -1 : chunkId - this.chunksInRow;
    const bottom = isBottomBorder ? -1 : chunkId + this.chunksInRow;
    const topLeft = isLeftBorder || isTopBorder ? -1 : top - 1;
    const topRight = isTopBorder || isRightBorder ? -1 : top + 1;
    const bottomLeft = isLeftBorder || isBottomBorder ? -1 : bottom - 1;
    const bottomRight = isRightBorder || isBottomBorder ? -1 : bottom + 1;
    return {
      left,
      right,
      top,
      bottom,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    };
  }
}
