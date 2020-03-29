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

		if (props.value >= props.greenRange[0] && props.value <= props.greenRange[1]) {
			ctx.fillStyle = "#00ff00";
		} else {
			ctx.fillStyle = "#e8d120";
		}

		const valueOffset = (props.value - props.range[0]) / (props.range[1] - props.range[0])

		ctx.fillRect(0, 0, valueOffset * width, height);
	}, [props.value, props.range, props.greenRange]);

	const { value, range, greenRange, ...rest } = props;

	return (
		<canvas ref={canvasRef} {...rest} />
	);
}
