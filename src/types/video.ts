export type VideoSource = {
	src: string;
	type?: string;
};

export type MovieVideo = {
	id: number;
	fallbackImage?: string;
	sources?: VideoSource[];
	zoom?: number;
};
