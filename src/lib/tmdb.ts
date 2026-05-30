const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const DEFAULT_LANGUAGE = 'ja-JP';

export type TmdbMovie = {
	id: number;
	title: string;
	overview: string;
	releaseDate: string;
	voteAverage: number;
	posterPath: string | null;
	backdropPath: string | null;
};

type TmdbMovieResponse = {
	id: number;
	title?: string;
	original_title?: string;
	overview?: string;
	release_date?: string;
	vote_average?: number;
	poster_path?: string | null;
	backdrop_path?: string | null;
};

type TmdbMovieListResponse = {
	results?: TmdbMovieResponse[];
};

function getApiKey() {
	// APIキーを読み込み
	const apiKey = import.meta.env.TMDB_API_KEY;

	if (!apiKey) {
		throw new Error('TMDB_API_KEY is not set. Add it to your .env file.');
	}

	return apiKey;
}

function normalizeMovie(movie: TmdbMovieResponse): TmdbMovie {
	// データ型にして戻り値として返す
	return {
		id: movie.id,
		title: movie.title ?? movie.original_title ?? 'Untitled',
		overview: movie.overview ?? '',
		releaseDate: movie.release_date ?? '',
		voteAverage: movie.vote_average ?? 0,
		posterPath: movie.poster_path ?? null,
		backdropPath: movie.backdrop_path ?? null,
	};
}

export async function getMovie(id: number): Promise<TmdbMovie> {
	const url = new URL(`${TMDB_BASE_URL}/movie/${id}`);

	url.searchParams.set('api_key', getApiKey());
	url.searchParams.set('language', DEFAULT_LANGUAGE);

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch TMDB movie ${id}: ${response.status}`);
	}

	const movie = (await response.json()) as TmdbMovieResponse;

	return normalizeMovie(movie);
}

export async function getMovies(ids: number[]): Promise<TmdbMovie[]> {
	return Promise.all(ids.map((id) => getMovie(id)));
}

export async function getNowPlayingMovies(limit = 12): Promise<TmdbMovie[]> {
	const url = new URL(`${TMDB_BASE_URL}/movie/now_playing`);

	// 各映画ごとの専用URLを作る
	url.searchParams.set('api_key', getApiKey());
	url.searchParams.set('language', DEFAULT_LANGUAGE);
	url.searchParams.set('region', 'JP');
	url.searchParams.set('page', '1');

	const response = await fetch(url);

	// APIキーが通らないとエラー
	if (!response.ok) {
		throw new Error(`Failed to fetch TMDB now playing movies: ${response.status}`);
	}

	const movies = (await response.json()) as TmdbMovieListResponse;

	return (movies.results ?? []).slice(0, limit).map(normalizeMovie);
}

export function getTmdbImageUrl(path: string | null, size = 'w780') {
	if (!path) {
		return null;
	}

	return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
