from django.core.paginator import Paginator
from rest_framework.decorators import api_view
from rest_framework.response import Response

from shock_predictor.models import ShockEvent, ShockAlert, ShockPrecursorPattern
from shock_predictor.scoring import get_current_score


@api_view(['GET'])
def current_score(request):
    return Response(get_current_score())


@api_view(['GET'])
def shock_history(request):
    qs = ShockEvent.objects.all()
    cause = request.query_params.get('cause')
    direction = request.query_params.get('direction')
    if cause:
        qs = qs.filter(cause_type=cause)
    if direction:
        qs = qs.filter(direction=direction)

    paginator = Paginator(qs, 20)
    page = paginator.get_page(request.query_params.get('page', 1))
    data = [{
        'date': e.date.isoformat(),
        'direction': e.direction,
        'magnitude': e.magnitude,
        'intraday_range': e.intraday_range,
        'cause_type': e.cause_type,
        'cause_summary': e.cause_summary,
        'headline': e.headline,
        'vix_open': e.vix_open,
        'index': e.index,
    } for e in page]
    return Response({
        'results': data,
        'total': paginator.count,
        'pages': paginator.num_pages,
    })


@api_view(['GET'])
def alert_log(request):
    alerts = ShockAlert.objects.all()[:50]
    data = [{
        'fired_at': a.fired_at.isoformat(),
        'score': a.score,
        'cause': a.cause_hypothesis,
        'headline': a.trigger_headline,
        'source': a.trigger_source,
        'hedge': a.suggested_hedge,
        'status': a.status,
        'eod_nifty_change': a.eod_nifty_change,
    } for a in alerts]
    return Response(data)


@api_view(['GET'])
def precursor_patterns(request):
    patterns = ShockPrecursorPattern.objects.all()
    return Response([{
        'cause_type': p.cause_type,
        'avg_iv_change_1hr': p.avg_iv_change_1hr,
        'avg_pcr_shift': p.avg_pcr_shift,
        'avg_vix_open': p.avg_vix_open,
        'keyword_fingerprint': p.keyword_fingerprint,
        'sample_count': p.sample_count,
        'updated_at': p.updated_at.isoformat(),
    } for p in patterns])
