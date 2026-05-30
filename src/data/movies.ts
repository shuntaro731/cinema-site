import mandalorianVideo from '../assets/video/mandalorian.mp4?url';
import marioVideo from '../assets/video/mario.mp4?url';
import pradaVideo from '../assets/video/prada2.mp4?url';

export type FeaturedMovie = {
	id: number;
	teaserUrl?: string;
	teaserZoom?: number;
};

export const featuredMovies: FeaturedMovie[] = [
	{
		id: 603,
		teaserUrl: marioVideo,
		teaserZoom: 1.08,
	},
	{
		id: 155,
		teaserUrl: mandalorianVideo,
		teaserZoom: 1.18,
	},
	{
		id: 129,
		teaserUrl: pradaVideo,
		teaserZoom: 1.08,
	},
];
