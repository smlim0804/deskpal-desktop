// 키보드 + 마우스 드래그(카메라 오빗) 입력
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // 이 프레임에 새로 눌린 키
    this.drag = { active: false, dx: 0, lastX: 0 };

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
    };
    this._onBlur = () => {
      this.keys.clear();
      this.drag.active = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    canvas.addEventListener('pointerdown', (e) => {
      this.drag.active = true;
      this.drag.lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag.active) return;
      this.drag.dx += e.clientX - this.drag.lastX;
      this.drag.lastX = e.clientX;
    });
    const end = (e) => {
      this.drag.active = false;
      if (e.pointerId != null && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  down(...keys) {
    return keys.some((k) => this.keys.has(k));
  }

  hit(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  // 이번 프레임 누적 드래그량을 꺼내 쓰고 비움
  takeDrag() {
    const dx = this.drag.dx;
    this.drag.dx = 0;
    return dx;
  }

  endFrame() {
    this.pressed.clear();
  }

  // 카메라 기준 이동 벡터 (-1..1)
  moveAxis() {
    let x = 0;
    let z = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) z += 1;
    if (this.down('s', 'arrowdown')) z -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }
}
