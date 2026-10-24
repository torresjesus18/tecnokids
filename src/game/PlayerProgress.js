class PlayerProgress {
  constructor({ points = 0, level = 1 }) { this.points = points; this.level = level; }
  get xpForNextLevel() { return this.level * 150; }
  get currentLevelAt() { return (this.level - 1) * this.level * 150 / 2; }
  get nextLevelAt() { return this.currentLevelAt + this.xpForNextLevel; }
  get xpIntoLevel() { return this.points - this.currentLevelAt; }
  get percentToNext() { return Math.floor((this.xpIntoLevel / this.xpForNextLevel) * 100); }
  toJSON() {
    return {
      points: this.points, level: this.level, currentLevelAt: this.currentLevelAt,
      nextLevelAt: this.nextLevelAt, xpIntoLevel: this.xpIntoLevel,
      xpForNextLevel: this.xpForNextLevel, percentToNext: this.percentToNext
    };
  }
}
module.exports = PlayerProgress;
