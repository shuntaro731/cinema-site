import mandalorianMp4 from '../assets/video/optimized/mandalorian-720p.mp4?url';
import mandalorianWebm from '../assets/video/optimized/mandalorian-720p.webm?url';
import marioMp4 from '../assets/video/optimized/mario-720p.mp4?url';
import marioWebm from '../assets/video/optimized/mario-720p.webm?url';
import pradaMp4 from '../assets/video/optimized/prada2-720p.mp4?url';
import pradaWebm from '../assets/video/optimized/prada2-720p.webm?url';
import mandalorianMovieImage from '../assets/movie-image/mandalorian.jpg?url';
import marioMovieImage from '../assets/movie-image/mario.jpg?url';
import pradaMovieImage from '../assets/movie-image/prada.jpg?url';

type FeaturedMovieVideoSource = {
	src: string;
	type: string;
};

export type FeaturedMovie = {
	id: number;
	movieImage: string;
	teaserSources?: FeaturedMovieVideoSource[];
	teaserZoom?: number;
};

// それぞれの動画をリストで管理してプロップスで渡す
export const featuredMovies: FeaturedMovie[] = [
	{
		id: 1,
		// 動画が表示されない時の予備
		movieImage: marioMovieImage,
		teaserSources: [
			// ios系のブラウザはwebmに対応してないのでmp4もリストに含める
			{ src: marioWebm, type: 'video/webm; codecs="vp9"' },
			{ src: marioMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
	{
		id: 2,
		movieImage: mandalorianMovieImage,
		teaserSources: [
			{ src: mandalorianWebm, type: 'video/webm; codecs="vp9"' },
			{ src: mandalorianMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
	{
		id: 3,
		movieImage: pradaMovieImage,
		teaserSources: [
			{ src: pradaWebm, type: 'video/webm; codecs="vp9"' },
			{ src: pradaMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
];
