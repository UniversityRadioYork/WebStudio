import React, { useRef, useLayoutEffect, useEffect, HTMLProps } from "react";

interface VUMeterProps extends HTMLProps<HTMLCanvasElement> {
	value: number;
	range: [number, number];
	greenRange: [number, number];
}

export function VUMeter(props: VUMeterProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

	useLayoutEffect(() => {
		if (canvasRef.current) {
			ctxRef.current = canvasRef.current.getContext("2d");
		}
	}, []);

	useEffect(() => {
		if (!canvasRef.current || !ctxRef.current) {
			return;
		}
		const valueRange = props.range[1] - props.range[0];
		const width = canvasRef.current.width;
		const height = canvasRef.current.height;

		const ctx = ctxRef.current;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = "#4ab81c";
		const leftGreen = Math.abs(props.greenRange[0] - props.range[0]) / (valueRange)
		const rightGreen = Math.abs(props.greenRange[1] - props.range[0]) / (valueRange)
		ctx.fillRect(leftGreen * width, 0, rightGreen * width - leftGreen * width, height);

		if (props.value >= props.greenRange[0] && props.value <= props.greenRange[1]) {
			ctx.fillStyle = "#00ff00";
		} else if (props.value < props.greenRange[0]) {
			ctx.fillStyle = "#e8d120";
		} else {
			ctx.fillStyle = "#ff0000";
		}

		const valueOffset = Math.abs(props.value - props.range[0]) / (valueRange)

		ctx.fillRect(0, 0, valueOffset * width, height - 10);

		ctx.fillStyle = "#fff";
		for (let i = 0; i < 10; i++) {
			const value = (props.range[0] + (valueRange * (i / 10))).toFixed(0);
			ctx.fillText(value, width * (i/10), height - 7);
		}
	}, [props.value, props.range, props.greenRange]);

	const { value, range, greenRange, ...rest } = props;

	return (
		<canvas ref={canvasRef} {...rest} />
	);
}
