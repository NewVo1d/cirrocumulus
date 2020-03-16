import React from 'react';
import {Dataset, ScatterGL} from 'scatter-gl';
import {getEmbeddingKey} from './actions';
import ChartToolbar from './ChartToolbar';
import {getChartSize} from './PlotUtil';

class ScatterChartThree extends React.PureComponent {

    constructor(props) {
        super(props);
        this.containerElementRef = React.createRef();
        this.scatterGL = null;
        this.chartSize = getChartSize();

        // window.addEventListener('resize', () => {
        //     scatterGL.resize();
        // });

    }


    static snapshot(scatterGL, traceInfo, markerOpacity) {
        const dataset = new Dataset(traceInfo.x, traceInfo.y, traceInfo.z, traceInfo.marker.color);
        scatterGL.render(dataset);
        scatterGL.setDimensions(traceInfo.z == null ? 2 : 3);
        scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
            const c = dataset.metadata[i];
            c.opacity = markerOpacity;
            return c;
        });
        scatterGL.render(dataset);
        scatterGL.updateScatterPlotAttributes();
        scatterGL.renderScatterPlot();
    }


    componentDidMount() {
        this.init();
        this.draw();
    }

    componentWillUnmount() {
        console.log('unmount');
        // if (this.scatterGL != null) {
        //     this.scatterGL.dispose();
        // }
    }


    onHome = () => {

    };

    onSaveImage = () => {
        // let layout = this.props.layout;
        // let height = layout.height;
        // let width = layout.width;
        // let context = new window.C2S(width, height);
        // this.drawContext(context);
        // let svg = context.getSerializedSvg();
        // let blob = new Blob([svg], {
        //     type: 'text/plain;charset=utf-8'
        // });
        // let name = this.props.data[0].name;
        // if (name === '__count') {
        //     name = 'count';
        // }
        // saveAs(blob, name + '.svg');
    };

    onDragMode = (mode) => {
        if (mode === 'pan') {
            this.scatterGL.setPanMode();
        } else if (mode === 'select') {
            this.scatterGL.setSelectMode();
        }
    };

    init() {
        const {traceInfo} = this.props;
        if (this.scatterGL == null) {
            this.scatterGL = new ScatterGL(this.containerElementRef.current, {
                renderMode: 'POINT',
                rotateOnStart: false,
                showLabelsOnHover: false,
                onSelect: (selectedpoints, boundingBox) => {
                    if (selectedpoints != null && selectedpoints.length === 0) {
                        selectedpoints = null;
                    }

                    if (selectedpoints == null) {
                        this.props.onDeselect({name: getEmbeddingKey(traceInfo.embedding)});
                    } else {

                        let xmin = Number.MAX_VALUE;
                        let ymin = Number.MAX_VALUE;
                        let zmin = Number.MAX_VALUE;
                        let xmax = -Number.MAX_VALUE;
                        let ymax = -Number.MAX_VALUE;
                        let zmax = -Number.MAX_VALUE;
                        const is3d = traceInfo.z != null;
                        selectedpoints.forEach(index => {
                            const x = traceInfo.x[index];
                            xmin = Math.min(xmin, x);
                            xmax = Math.max(xmax, x);
                            const y = traceInfo.y[index];
                            ymin = Math.min(ymin, y);
                            ymax = Math.max(ymax, y);
                            if (is3d) {
                                const z = traceInfo.z[index];
                                zmin = Math.min(zmin, z);
                                zmax = Math.max(zmax, z);
                            }
                        });


                        let path = {shape: 'rect', x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin};
                        if (is3d) {
                            path.shape = 'rect 3d';
                            path.z = zmin;
                            path.depth = zmax - zmin;
                        }
                        this.props.onSelected({
                            name: getEmbeddingKey(traceInfo.embedding),
                            value: {basis: traceInfo.embedding, selectedpoints: selectedpoints, path: path}
                        });
                    }
                },
                onHover: (point) => {


                }
            });
            this.scatterGL.setSelectMode();
        }
    }

    draw() {
        const scatterGL = this.scatterGL;
        const {traceInfo, markerOpacity, unselectedMarkerOpacity, selection, color} = this.props;
        console.log(traceInfo.name);
        scatterGL.setSelectedPointIndices(selection);
        const dataset = new Dataset(traceInfo.x, traceInfo.y, traceInfo.z, color);
        scatterGL.render(dataset);
        scatterGL.setDimensions(traceInfo.z == null ? 2 : 3);
        scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
            const c = dataset.metadata[i];
            c.opacity = markerOpacity;
            // if (hoverIndex === i) {
            //     return c.brighter();
            // }
            const isSelected = selectedIndices.size === 0 || selectedIndices.has(i);
            if (!isSelected) {
                c.opacity = unselectedMarkerOpacity;
            }
            return c;
        });
        scatterGL.render(dataset);
        scatterGL.updateScatterPlotAttributes();
        scatterGL.renderScatterPlot();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.draw();
    }

    render() {
        return <div><ChartToolbar onHome={this.onHome}
                                  onSaveImage={this.onSaveImage}
                                  onDragMode={this.onDragMode}></ChartToolbar>
            <div style={{display: 'inline-block', width: this.chartSize.width, height: this.chartSize.height}}
                 ref={this.containerElementRef}/>
        </div>;
    }
}

export default ScatterChartThree;



