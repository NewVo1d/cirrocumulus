import pandas as pd
import scipy.sparse

from cirro.dotplot_aggregator import DotPlotAggregator
from cirro.embedding_aggregator import EmbeddingAggregator, get_basis
from cirro.feature_aggregator import FeatureAggregator
from cirro.ids_aggregator import IdsAggregator
from cirro.simple_data import SimpleData
from cirro.unique_aggregator import UniqueAggregator


def filter_adata(adata, data_filter):
    if data_filter is not None:
        keep_expr = None
        user_filters = data_filter.get('filters', [])
        for filter_obj in user_filters:
            field = filter_obj[0]
            op = filter_obj[1]
            value = filter_obj[2]
            if isinstance(field, dict):
                selected_points_basis = get_basis(field['basis'], field.get('nbins'),
                    field.get('agg'), field.get('ndim', '2'), field.get('precomputed', False))
                obs_field = selected_points_basis['full_name'] if selected_points_basis[
                                                                      'nbins'] is not None else 'index'
                points = value['selectedpoints']
                if obs_field == 'index':
                    keep = adata.obs.index.isin(points)
                else:
                    keep = adata.obs[obs_field].isin(points)
            else:
                if field in adata.obs:
                    X = adata.obs[field]
                else:
                    indices = SimpleData.get_var_indices(adata, [field])
                    X = adata.X[:, indices[0]]
                if op == 'in':
                    keep = (X.isin(value)).values
                elif op == '>':
                    keep = (X > value)
                elif op == '=':
                    keep = (X == value)
                elif op == '<':
                    keep = (X < value)
                elif op == '!=':
                    keep = (X != value)
                elif op == '>=':
                    keep = (X >= value)
                elif op == '<=':
                    keep = (X <= value)
                else:
                    raise ValueError('Unknown filter')

            if scipy.sparse.issparse(keep):
                keep = keep.toarray().flatten()
            if isinstance(keep, pd.Series):
                keep = keep.values
            keep_expr = keep_expr & keep if keep_expr is not None else keep
        adata = SimpleData.view(adata, keep_expr) if keep_expr is not None else adata
    return adata


def precomputed_summary(dataset_api, dataset, obs_measures, var_measures, dimensions):
    result = {}
    if '__count' in var_measures:
        var_measures.remove('__count')
    for dimension in dimensions:
        df = dataset_api.read_summarized(dataset, obs_keys=[dimension], path='counts')
        result[dimension] = dict(categories=df['index'].values.tolist(), counts=df['value'].values.tolist())

    if (len(obs_measures) + len(var_measures)) > 0:
        df = dataset_api.read_summarized(dataset, var_keys=var_measures, obs_keys=obs_measures, path='statistics',
            rename=True)
        for column in obs_measures + var_measures:
            result[column] = {'min': float(df['{}_min'.format(column)][0]),
                              'max': float(df['{}_max'.format(column)][0]),
                              'sum': float(df['{}_sum'.format(column)][0]),
                              'mean': float(df['{}_mean'.format(column)][0])}
            if '{}_numExpressed'.format(column) in df:
                result[column]['numExpressed'] = int(df['{}_numExpressed'.format(column)][0])
    return result


def precomputed_grouped_stats(dataset_api, dataset, var_measures, dimensions):
    result = []
    if (len(var_measures)) > 0 and len(dimensions) > 0:
        for dimension in dimensions:
            df = dataset_api.read_summarized(dataset, index=True, rename=True, obs_keys=[],
                var_keys=var_measures, path='grouped_statistics/' + dimension)
            values = []
            dimension_result = dict(categories=df['index'].values.tolist(), name=dimension, values=values)
            result.append(dimension_result)
            for measure in var_measures:
                fraction_expressed = df[measure + '_fractionExpressed'].values.tolist()
                mean = df[measure + '_mean'].values.tolist()
                values.append(dict(name=measure, fractionExpressed=fraction_expressed, mean=mean))

    return result


def precomputed_embedding(dataset_api, dataset, basis, obs_measures, var_measures,
                          dimensions):
    if (len(obs_measures) + len(var_measures) + len(dimensions)) == 0:
        obs_measures = ['__count']

    path = 'obsm_summary/' + basis['full_name']
    df = dataset_api.read_summarized(dataset, obs_keys=obs_measures + dimensions, var_keys=var_measures,
        index=True, rename=True, path=path)
    result = {'coordinates': {}, 'values': {}, 'bins': df['index'].values.tolist()}

    for column in basis['coordinate_columns']:
        result['coordinates'][column] = df[column].values.tolist()

    for key in obs_measures + var_measures:
        result['values'][key] = df[key + '_value'].values.tolist()
    for key in dimensions:
        result['values'][key] = dict(value=df[key + '_value'].values.tolist(),
            purity=df[key + '_purity'].values.tolist())
    return result


def get_var_name_type(key):
    index = key.find('/')
    if index == -1:
        return key, 'X'
    else:
        key_type = key[0:index]
        name = key[index + 1:]
        return name, key_type


def split_measures(measures):
    obs_measures = []
    var_measures = []
    for i in range(len(measures)):
        name, key_type = get_var_name_type(measures[i])
        if key_type == 'X':
            var_measures.append(name)
        elif key_type == 'obs':
            obs_measures.append(name)
        else:
            raise ValueError('Unknown key type: ' + key_type)
    return obs_measures, var_measures


def handle_embedding(dataset_api, dataset, basis, measures=[], dimensions=[]):
    obs_measures, var_measures = split_measures(measures)
    if basis['precomputed']:
        result = precomputed_embedding(dataset_api, dataset, basis, obs_measures, var_measures, dimensions)
    else:
        count = '__count' in var_measures
        if count:
            var_measures.remove('__count')
        adata = dataset_api.read(dataset=dataset, obs_keys=dimensions + obs_measures,
            var_keys=var_measures, basis=[basis])
        if basis['nbins'] is not None:
            EmbeddingAggregator.convert_coords_to_bin(df=adata.obs,
                nbins=basis['nbins'],
                coordinate_columns=basis['coordinate_columns'],
                bin_name=basis['full_name'])

        result = EmbeddingAggregator(obs_measures=obs_measures,
            var_measures=var_measures, dimensions=dimensions,
            count=count,
            nbins=basis['nbins'], basis=basis, agg_function=basis['agg']).execute(adata)
    return result


def handle_grouped_stats(dataset_api, dataset, measures=[], dimensions=[]):
    # all dot plot measures are in X
    result = {}
    if dataset.get('precomputed', False):
        result['dotplot'] = precomputed_grouped_stats(dataset_api, dataset, measures, dimensions)
    else:
        adata = dataset_api.read(dataset=dataset, obs_keys=dimensions, var_keys=measures)
        result['dotplot'] = DotPlotAggregator(var_measures=measures,
            dimensions=dimensions).execute(adata)
    return result


def handle_stats(dataset_api, dataset, measures=[], dimensions=[]):
    result = {}
    obs_measures, var_measures = split_measures(measures)
    if dataset.get('precomputed', False):
        result['summary'] = precomputed_summary(dataset_api, dataset, obs_measures, var_measures,
            dimensions)
    else:
        adata = dataset_api.read(dataset=dataset, obs_keys=obs_measures + dimensions, var_keys=var_measures)
        result['summary'] = FeatureAggregator(obs_measures, var_measures, dimensions).execute(adata)
    return result


def handle_export_dataset_filters(dataset_api, dataset, data_filters):
    import json
    reformatted_filters = []
    filter_names = []
    for data_filter_obj in data_filters:
        filter_value = json.loads(data_filter_obj['value'])
        filter_names.append(data_filter_obj['name'])
        reformatted_filters.append(filter_value)

    adata_info = get_data(dataset_api, dataset, measures=['obs/index'], data_filters=reformatted_filters)
    result_df = pd.DataFrame(index=adata_info['adata'].obs['index'])
    for i in range(len(reformatted_filters)):
        data_filter = reformatted_filters[i]
        filter_name = filter_names[i]
        adata_filtered = filter_adata(adata_info['adata'], data_filter)
        df = pd.DataFrame(index=adata_filtered.obs['index'])
        df[filter_name] = True
        result_df = result_df.join(df, rsuffix='r')
    result_df.fillna(False, inplace=True)
    return result_df.to_csv()


def handle_selection(dataset_api, dataset, embeddings=[], measures=[], dimensions=[], data_filter=None, stats=True):
    selection_info = get_selected_data(dataset_api, dataset, embeddings=embeddings, measures=measures,
        dimensions=dimensions, data_filter=data_filter)
    basis_objs = selection_info['basis']
    obs_measures = selection_info['obs_measures']
    var_measures = selection_info['var_measures']
    adata = selection_info['adata']

    result = {}
    if len(basis_objs) > 0:
        result['coordinates'] = {}
        for basis_obj in basis_objs:
            result['coordinates'][basis_obj['full_name']] = UniqueAggregator(
                basis_obj['full_name'] if basis_obj['nbins'] is not None else 'index').execute(adata)
    if stats:
        result['summary'] = FeatureAggregator(obs_measures, var_measures, dimensions).execute(adata)
    result['count'] = adata.shape[0]
    return result


def handle_selection_ids(dataset_api, dataset, data_filter):
    selection_info = get_selected_data(dataset_api, dataset, measures=['obs/index'], data_filter=data_filter)
    return {'ids': IdsAggregator().execute(selection_info['adata'])}


def get_data(dataset_api, dataset, embeddings=[], measures=[], dimensions=[], data_filters=[]):
    obs_measures, var_measures = split_measures(measures)
    var_keys_filter = []
    obs_keys_filter = []
    selected_points_filter_basis_list = []
    for data_filter in data_filters:
        _var_keys_filter, _obs_keys_filter, selected_points_filter_basis_list = data_filter_keys(data_filter)
        selected_points_filter_basis_list += selected_points_filter_basis_list
        var_keys_filter += _var_keys_filter
        obs_keys_filter += _obs_keys_filter
    obs_keys = list(set(obs_measures + obs_keys_filter + dimensions))
    var_keys = list(set(var_measures + var_keys_filter))
    basis_objs = []
    basis_keys = set()
    for embedding in embeddings:
        basis_obj = get_basis(embedding['basis'], embedding.get('nbins'), embedding.get('agg'),
            embedding.get('ndim', '2'), embedding.get('precomputed', False))
        if basis_obj['full_name'] not in basis_keys:
            basis_objs.append(basis_obj)
            basis_keys.add(basis_obj['full_name'])
    for basis_obj in selected_points_filter_basis_list:
        if basis_obj['full_name'] not in basis_keys:
            basis_objs.append(basis_obj)
            basis_keys.add(basis_obj['full_name'])
    adata = dataset_api.read(dataset=dataset, obs_keys=obs_keys, var_keys=var_keys, basis=basis_objs)
    for basis_obj in basis_objs:
        if not basis_obj['precomputed'] and basis_obj['nbins'] is not None:
            EmbeddingAggregator.convert_coords_to_bin(df=adata.obs,
                nbins=basis_obj['nbins'],
                bin_name=basis_obj['full_name'],
                coordinate_columns=basis_obj['coordinate_columns'])
    return {'adata': adata, 'basis': basis_objs, 'obs_measures': obs_measures, 'var_measures': var_measures,
            'dimensions': dimensions}


def get_selected_data(dataset_api, dataset, embeddings=[], measures=[], dimensions=[], data_filter=None):
    adata_info = get_data(dataset_api, dataset, embeddings, measures, dimensions,
        [data_filter] if data_filter is not None else [])
    adata = filter_adata(adata_info['adata'], data_filter)
    adata_info['adata'] = adata
    return adata_info


def data_filter_keys(data_filter):
    var_keys = set()
    obs_keys = set()
    basis_list = []
    if data_filter is not None:
        user_filters = data_filter.get('filters', [])

        for i in range(len(user_filters)):
            user_filter = user_filters[i]
            key = user_filter[0]
            if isinstance(key, dict):
                basis = get_basis(key['basis'], key.get('nbins'), key.get('agg'),
                    key.get('ndim', '2'), key.get('precomputed', False))
                basis_list.append(basis)
            else:
                name, key_type = get_var_name_type(key)
                user_filter[0] = name
                if key_type == 'X':
                    var_keys.add(name)
                else:
                    obs_keys.add(name)
    return list(var_keys), list(obs_keys), basis_list
