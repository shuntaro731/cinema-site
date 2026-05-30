import mandalorianMp4 from '../assets/video/optimized/mandalorian-720p.mp4?url';
import mandalorianWebm from '../assets/video/optimized/mandalorian-720p.webm?url';
import marioMp4 from '../assets/video/optimized/mario-720p.mp4?url';
import marioWebm from '../assets/video/optimized/mario-720p.webm?url';
import pradaMp4 from '../assets/video/optimized/prada2-720p.mp4?url';
import pradaWebm from '../assets/video/optimized/prada2-720p.webm?url';

export type FeaturedMovieVideoSource = {
	src: string;
	type: string;
};

export type FeaturedMovie = {
	id: number;
	teaserSources?: FeaturedMovieVideoSource[];
	teaserZoom?: number;
};

export const featuredMovies: FeaturedMovie[] = [
	{
		id: 1,
		teaserSources: [
			{ src: marioWebm, type: 'video/webm; codecs="vp9"' },
			{ src: marioMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.08,
	},
	{
		id: 2,
		teaserSources: [
			{ src: mandalorianWebm, type: 'video/webm; codecs="vp9"' },
			{ src: mandalorianMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.18,
	},
	{
		id: 3,
		teaserSources: [
			{ src: pradaWebm, type: 'video/webm; codecs="vp9"' },
			{ src: pradaMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.08,
	},
];
