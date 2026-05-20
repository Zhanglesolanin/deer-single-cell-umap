"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plotly = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function Plot(props: PlotParams) {
  const modifiedConfig = props.config ? {
    ...props.config,
    modeBarButtonsToRemove: [
      'lasso2d',
      'select2d',
      'zoomIn2d',
      'zoomOut2d',
      'autoScale2d',
      'resetScale2d',
      'hoverClosestCartesian',
      'hoverCompareCartesian',
    ],
  } : {
    modeBarButtonsToRemove: [
      'lasso2d',
      'select2d',
      'zoomIn2d',
      'zoomOut2d',
      'autoScale2d',
      'resetScale2d',
      'hoverClosestCartesian',
      'hoverCompareCartesian',
    ],
  };

  return <Plotly {...props} config={modifiedConfig} />;
}
