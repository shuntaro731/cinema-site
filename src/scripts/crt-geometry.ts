import { BufferGeometry, Float32BufferAttribute } from 'three';

export function createCrtScreenGeometry(width: number, height: number, columns: number, rows: number) {
	const geometry = new BufferGeometry();
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const halfWidth = width / 2;
	const halfHeight = height / 2;

	for (let row = 0; row <= rows; row += 1) {
		const v = row / rows;
		const ny = v * 2 - 1;

		for (let column = 0; column <= columns; column += 1) {
			const u = column / columns;
			const nx = u * 2 - 1;
			const absX = Math.abs(nx);
			const absY = Math.abs(ny);
			const edgeBlendX = Math.pow(absX, 2.1);
			const edgeBlendY = Math.pow(absY, 2.1);
			const cornerBlend = Math.pow(absX * absY, 3.2);
			const horizontalArc = 1 - nx * nx;
			const verticalArc = 1 - ny * ny;
			let x = nx * halfWidth;
			let y = ny * halfHeight;

			x *= 1 - edgeBlendY * 0.032;
			y *= 1 - edgeBlendX * 0.026;
			x += nx * verticalArc * 0.035;
			y += ny * horizontalArc * 0.04;
			x -= Math.sign(nx) * cornerBlend * 0.13;
			y -= Math.sign(ny) * cornerBlend * 0.09;

			const radius = nx * nx + ny * ny;
			const z = -(radius * 0.09 + cornerBlend * 0.055);

			positions.push(x, y, z);
			uvs.push(u, v);
		}
	}

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const current = row * (columns + 1) + column;
			const next = current + columns + 1;

			indices.push(current, current + 1, next);
			indices.push(current + 1, next + 1, next);
		}
	}

	geometry.setIndex(indices);
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	geometry.computeVertexNormals();

	return geometry;
}
