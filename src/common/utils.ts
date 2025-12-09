export function drawRectangle(startX : number, startY : number, stopX : number, stopY : number) : number[] {
  return [
    startX, startY,
    startX + (stopX - startX), startY,
    startX, startY + (stopY - startY),
    startX + (stopX - startX), startY + (stopY - startY),
    startX + (stopX - startX), startY,
    startX, startY + (stopY - startY),
  ];
}

export function colorRectangle(r : number, g : number, b : number, a : number) : number[] {
  return [
    r, g, b, a,
    r, g, b, a,
    r, g, b, a,
    r, g, b, a,
    r, g, b, a,
    r, g, b, a,
  ];
}

export function drawCircle(radius: number, x: number, y: number, n : number = 50) : number[] {
  let circle : number[] = [x, y];
  
  for (let i : number = 0; i <= n; i++) {
      const angle : number = (i / n) * 2 * Math.PI;
      circle.push(radius * Math.cos(angle) + x);
      circle.push(radius * Math.sin(angle) + y);
      circle.push(x);
      circle.push(y);
      circle.push(radius * Math.cos(angle) + x);
      circle.push(radius * Math.sin(angle) + y);
  }

  circle.pop();
  circle.pop();

  return circle;
}

export function colorCircle(r: number, g: number, b: number, a: number, n : number = 50) : number[] {
  let colors : number[] = [r, g, b, a];

  for (let i : number = 0; i <= n; i++) {
    colors.push(r);
    colors.push(g);
    colors.push(b);
    colors.push(a);
    colors.push(r);
    colors.push(g);
    colors.push(b);
    colors.push(a);
    colors.push(r);
    colors.push(g);
    colors.push(b);
    colors.push(a);
  }

  colors.pop();
  colors.pop();
  colors.pop();
  colors.pop();

  return colors;
}
