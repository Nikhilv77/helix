import React from "react";
import { Composition, registerRoot } from "remotion";
import { DemoFilm } from "./demo-film";
import { FPS } from "./kit";
import { RoundsFilm } from "./rounds-film";

registerRoot(() => (
  <>
    <Composition id="TrailgradDemo" component={DemoFilm} width={1920} height={1080} fps={FPS} durationInFrames={1620} />
    <Composition id="TrailgradRounds" component={RoundsFilm} width={1920} height={1080} fps={FPS} durationInFrames={1440} />
    {/* 4:5 phone cuts: the same films laid out for a tall frame. */}
    <Composition id="TrailgradDemoPortrait" component={DemoFilm} width={1080} height={1350} fps={FPS} durationInFrames={1620} />
    <Composition id="TrailgradRoundsPortrait" component={RoundsFilm} width={1080} height={1350} fps={FPS} durationInFrames={1440} />
  </>
));
