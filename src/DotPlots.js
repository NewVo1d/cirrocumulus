import {groupBy} from 'lodash';
import React from 'react';

import {connect} from 'react-redux';
import {setDotPlotInterpolator, setDotPlotOptions} from './actions';
import {DotPlotGroup} from './DotPlotGroup';

class DotPlots extends React.PureComponent {
    render() {
        const {
            chartOptions,
            dotPlotData,
            dotPlotInterpolator,
            categoricalNames,
            dotPlotOptions,
            handleInterpolator,
            onDotPlotOptions,
            selectedDotPlotData,
            searchTokens
        } = this.props;

        if (dotPlotData.length === 0) {
            return <h4>Please enter one or more categorical observations and one or more features.</h4>;
        }
        const textColor = chartOptions.darkMode ? 'white' : 'black';
        let dimension2data = groupBy(dotPlotData, 'dimension');
        let dimension2selecteddata = groupBy(selectedDotPlotData, 'dimension');

        return <React.Fragment>{Object.keys(dimension2data).map(dimension => <DotPlotGroup key={dimension}
                                                                                           dotPlotData={dimension2data[dimension]}
                                                                                           selectedData={dimension2selecteddata[dimension]}
                                                                                           interpolator={dotPlotInterpolator}
                                                                                           handleInterpolator={handleInterpolator}
                                                                                           onDotPlotOptions={onDotPlotOptions}
                                                                                           dotPlotOptions={dotPlotOptions}
                                                                                           renamedCategories={categoricalNames[dimension] || {}} // TODO rename multiple
                                                                                           textColor={textColor}/>)}</React.Fragment>;
    }


}

const mapStateToProps = state => {
    return {
        chartOptions: state.chartOptions,
        dotPlotInterpolator: state.dotPlotInterpolator,
        dotPlotData: state.dotPlotData,
        dotPlotOptions: state.dotPlotOptions,
        selectedDotPlotData: state.selectedDotPlotData,
        categoricalNames: state.categoricalNames,
        searchTokens: state.searchTokens
    };
};
const mapDispatchToProps = dispatch => {
    return {
        onDotPlotOptions: (payload) => {
            dispatch(setDotPlotOptions(payload));
        },
        handleInterpolator: value => {
            dispatch(setDotPlotInterpolator(value));
        },
    };
};

export default (connect(
    mapStateToProps, mapDispatchToProps,
)(DotPlots));

