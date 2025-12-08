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

export function drawCircle(radius: number, x: number, y: number, n : number = 100) : number[] {
  let circle : number[] = [0.0, 0.0];
  
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

