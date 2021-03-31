import {scaleOrdinal} from 'd3-scale';
import {schemeCategory10} from 'd3-scale-chromatic';
import natsort from 'natsort';
import React from 'react';
import {connect} from 'react-redux';
import CompositionPlot from './CompositionPlot';
import {FEATURE_TYPE} from './util';

function getColorScale(embeddingData, dimension) {
    let categoryColorScale = null;
    for (let i = 0; i < embeddingData.length; i++) {
        if (dimension === embeddingData[i].name) {
            categoryColorScale = embeddingData[i].colorScale; // TODO make color scale independent of embedding
            break;
        }
    }
    if (categoryColorScale == null) {
        categoryColorScale = scaleOrdinal(schemeCategory10); // TODO make color scale independent of embedding
    }
    return categoryColorScale;
}

function getComposition(dataset, obsCat, cachedData, categoricalNames, selection) {
    const ncategories = obsCat.length;

    if (ncategories >= 2) {
        let categoryValues = [];
        let nObs = dataset.shape[0];
        const renamedDimensions = [];
        for (let categoryIndex = 0; categoryIndex < ncategories; categoryIndex++) {
            const array = cachedData[obsCat[categoryIndex]];
            if (array == null) {
                return null;
            }
            categoryValues.push(array);
            renamedDimensions.push(categoricalNames[obsCat[categoryIndex]] || {});
        }
        const hasSelection = selection != null && selection.size > 0;

        const categoryToValueToCounts = {};
        for (let i = 0; i < nObs; i++) {
            if (hasSelection && !selection.has(i)) {
                continue;
            }
            const seriesArray = [];
            for (let categoryIndex = 0; categoryIndex < ncategories - 1; categoryIndex++) {
                let value = categoryValues[categoryIndex][i];
                const nameMap = renamedDimensions[categoryIndex];
                let newValue = nameMap[value];
                if (newValue !== undefined) {
                    value = newValue;
                }
                seriesArray.push(value);
            }
            const series = seriesArray.join(',');
            let valueToCounts = categoryToValueToCounts[series];
            if (valueToCounts === undefined) {
                valueToCounts = {};
                categoryToValueToCounts[series] = valueToCounts;
            }
            const category = categoryValues[ncategories - 1][i];
            const count = valueToCounts[category] || 0;
            valueToCounts[category] = count + 1;
        }
        const sorter = natsort({insensitive: true});
        const series = Object.keys(categoryToValueToCounts);
        series.sort(sorter);
        let uniqueValuesSet = new Set();
        for (let key in categoryToValueToCounts) {
            const valueToCounts = categoryToValueToCounts[key];
            for (const value in valueToCounts) {
                uniqueValuesSet.add(value);
            }
        }

        const uniqueValues = Array.from(uniqueValuesSet);
        uniqueValues.sort(sorter);
        return {categoryToValueToCounts: categoryToValueToCounts, uniqueValues: uniqueValues, series: series};
    }
    return null;
}


function CompositionPlots(props) {
    const {cachedData, categoricalNames, chartOptions, dataset, embeddingData, searchTokens, selection} = props;
    const obsCat = searchTokens.filter(item => item.type === FEATURE_TYPE.OBS_CAT).map(item => item.value);
    if (obsCat.length > 1) {
        const dimension = obsCat[obsCat.length - 1];
        const colorScale = getColorScale(embeddingData, dimension);
        const composition = getComposition(dataset, obsCat, cachedData, categoricalNames);
        if (composition == null) {
            return null;
        }
        const textColor = chartOptions.darkMode ? 'white' : 'black';
        const selectedComposition = selection.size > 0 ? getComposition(dataset, obsCat, cachedData, categoricalNames, selection) : null;
        const title = dimension + ' composition in ' + obsCat.slice(0, obsCat.length - 1).join(', ');
        return <React.Fragment><CompositionPlot categoryToValueToCounts={composition.categoryToValueToCounts}
                                                dimension={dimension}
                                                title={title}
                                                colorScale={colorScale} series={composition.series}
                                                uniqueValues={composition.uniqueValues}
                                                textColor={textColor}/>

            {selectedComposition &&
            <CompositionPlot categoryToValueToCounts={selectedComposition.categoryToValueToCounts}
                             dimension={dimension}
                             title={title}
                             subtitle="selection"
                             colorScale={colorScale} series={selectedComposition.series}
                             uniqueValues={selectedComposition.uniqueValues}
                             textColor={textColor}/>}</React.Fragment>;
    }
    return null;
}

const mapStateToProps = state => {
    return {
        cachedData: state.cachedData,
        categoricalNames: state.categoricalNames,
        chartOptions: state.chartOptions,
        dataset: state.dataset,
        embeddingData: state.embeddingData,
        searchTokens: state.searchTokens,
        selection: state.selection
    };
};
const mapDispatchToProps = dispatch => {
    return {};
};

export default (connect(
    mapStateToProps, mapDispatchToProps,
)(CompositionPlots));

