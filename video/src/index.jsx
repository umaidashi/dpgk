import React from "react";
import { registerRoot, Composition } from "remotion";
import { Intro, DURATION } from "./Intro";

const Root = () => (
  <Composition id="Intro" component={Intro} durationInFrames={DURATION} fps={30} width={1280} height={720} />
);

registerRoot(Root);
