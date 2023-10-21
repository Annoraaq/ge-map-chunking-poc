import Phaser from "phaser";
import { GridEngine } from "grid-engine";
import { MainScene } from "./MainScene";

const config: Phaser.Types.Core.GameConfig = {
  title: "Grid Engine map chunking example",
  pixelArt: true,
  type: Phaser.AUTO,
  scale: {
    width: 400,
    height: 400,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 3,
  },
  plugins: {
    scene: [
      {
        key: "ge",
        plugin: GridEngine,
        mapping: "ge",
      },
    ],
  },
  scene: [MainScene],
  parent: "game",
  backgroundColor: "#344A58",
};
new Phaser.Game(config);
