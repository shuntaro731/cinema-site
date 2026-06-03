export type VideoSource = {
	src: string;
	type?: string;
};

export type MovieVideo = {
	id: number;
	movieImage?: string;
	sources?: VideoSource[];
	zoom?: number;
};
