import type { FeaturedMovie } from '../data/movies';
import type { MovieVideo } from '../types/video';

export function toCrtMovies(movies: FeaturedMovie[]): MovieVideo[] {
	return movies.map((movie) => ({
		id: movie.id,
		fallbackImage: movie.fallbackImage,
		sources: movie.teaserSources ?? [],
		zoom: movie.teaserZoom,
	}));
}

export function serializeCrtMovies(movies: FeaturedMovie[]) {
	return JSON.stringify(toCrtMovies(movies));
}
