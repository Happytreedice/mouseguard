const gulp = require('gulp');
const less = require('gulp-less');
const esbuild = require('esbuild');
const esbuildSvelte = require("esbuild-svelte");


/* ----------------------------------------- */
/*  Compile LESS
/* ----------------------------------------- */

function compileLESS() {
  return gulp.src("styles/mouseguard.less")
    .pipe(less())
    .pipe(gulp.dest("./styles/"));
}
const css = gulp.series(compileLESS);


//Compile JS
async function buildCode() {
  return esbuild.build({
    entryPoints: ["./module/mouseguard.js"],
    bundle: true,
    outfile: `./dist/mouseguard.js`,
    sourcemap: true,
    minify: false,
    format: "esm",
    platform: "browser",
    plugins: [esbuildSvelte()],
    external: ["../assets/*"],
  });
}

const build = gulp.series(compileLESS, buildCode);
exports.build = build;

const SYSTEM_FILES = ["module/**/*.js", "module/*.js", "module/**/*.svelte", "styles/*.less"];

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_FILES, build);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  build,
  watchUpdates,
);
exports.css = css;
