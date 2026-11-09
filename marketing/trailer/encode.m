% Encodes marketing/trailer/frames/*.jpg into quillon-trailer.mp4 (H.264, 30 fps).
% Run from the repository root:  matlab -batch "run('marketing/trailer/encode.m')"
here = fileparts(mfilename('fullpath'));
files = dir(fullfile(here, 'frames', 'f*.jpg'));
assert(~isempty(files), 'No frames: run node marketing/trailer/render.mjs first');
v = VideoWriter(fullfile(here, 'quillon-trailer.mp4'), 'MPEG-4');
v.FrameRate = 30;
v.Quality = 95;
open(v);
for k = 1:numel(files)
    writeVideo(v, imread(fullfile(here, 'frames', files(k).name)));
end
close(v);
fprintf('wrote %d frames to %s\n', numel(files), fullfile(here, 'quillon-trailer.mp4'));
