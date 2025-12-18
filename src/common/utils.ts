import { vec3 } from 'wgpu-matrix';

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

export const degToRad  = (d : number) : number => d * Math.PI / 180;

export function subdivideSphere(positions : Float32Array[], indices : Uint32Array) : Uint32Array {
  const triangles : number = indices.length / 3;
  let newIndices : number[] = [];
  for (let i : number = 0; i < triangles; i++) {
    const i0 : number = indices[i * 3 + 0]
    const i1 : number = indices[i * 3 + 1]
    const i2 : number = indices[i * 3 + 2]
    const c01 : number = positions.length;
    const c12 : number = positions.length + 1;
    const c20 : number = positions.length + 2;
    positions.push(vec3.normalize(vec3.add(positions[i0], positions[i1])))
    positions.push(vec3.normalize(vec3.add(positions[i1], positions[i2])))
    positions.push(vec3.normalize(vec3.add(positions[i2], positions[i0])))
    newIndices.push(i0, c01, c20, c20, c01, c12, c12, c01, i1, c20, c12, i2);
  }
  return new Uint32Array(newIndices);
}

export function subdivideIndices(indices : Uint32Array) : Uint32Array {
  const triangles : number = indices.length / 3;
  let newIndices : number[] = [];
  for (let i : number = 0; i < triangles; i++) {
    const c01 : number = triangles + i * 3 + 0;
    const c12 : number = triangles + i * 3 + 1;
    const c20 : number = triangles + i * 3 + 2;
    newIndices.push(indices[i * 3 + 0], c01, c20, c20, c01, c12, c12, c01, indices[i * 3 + 1], c20, c12, indices[i * 3 + 2]);
  }
  return new Uint32Array(newIndices);
}

export function coarsenIndices(indices : Uint32Array) : Uint32Array {
  let newIndices : number[] = [];
  for (let i : number = 0; i < indices.length / 12; i++) {
    newIndices.push(indices[i * 12 + 0], indices[i * 12 + 8], indices[i * 12 + 11]);
  }
  return new Uint32Array(newIndices);
}

