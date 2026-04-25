import { View, Text } from 'react-native';

interface Props {
  match: any;
  summary: any;
  compact?: boolean;
}

export default function ScoreBoard({ match, summary, compact = false }: Props) {
  const cs = summary?.currentState;
  const inningsNum = cs?.innings || 1;
  const inningsSummary = summary?.innings?.[inningsNum - 1];

  if (!cs) return null;

  const overs = `${cs.over}.${cs.ball}`;
  const runs  = cs.totalRuns ?? 0;
  const wkts  = cs.wickets ?? 0;

  const battingTeam = inningsNum === 1
    ? match?.innings?.first?.battingTeam
    : match?.innings?.second?.battingTeam;

  const teamName = battingTeam?.name || `Innings ${inningsNum}`;

  return (
    <View className={`${compact ? 'px-4 py-2' : 'mx-4 my-3 rounded-2xl bg-white/10 px-4 py-3'}`}>
      {/* Main score */}
      <View className="flex-row items-baseline justify-between">
        <View>
          <Text className={`font-bold ${compact ? 'text-white text-sm' : 'text-white text-base'}`}>
            {teamName}
          </Text>
          <View className="flex-row items-baseline gap-2">
            <Text className={`font-black text-accent ${compact ? 'text-3xl' : 'text-5xl'}`}>
              {runs}/{wkts}
            </Text>
            <Text className="text-blue-200 text-base">({overs} ov)</Text>
          </View>
        </View>

        {/* Target / Run Rate */}
        <View className="items-end">
          {cs.target && (
            <>
              <Text className="text-blue-200 text-xs">Target</Text>
              <Text className="text-white text-xl font-bold">{cs.target}</Text>
              {cs.requiredRuns !== null && (
                <Text className="text-accent text-xs">
                  Need {cs.requiredRuns} in {Math.ceil(cs.requiredRuns / (cs.requiredRate || 1))} balls
                </Text>
              )}
            </>
          )}
          {!cs.target && (
            <>
              <Text className="text-blue-200 text-xs">Run Rate</Text>
              <Text className="text-white text-xl font-bold">{(cs.currentRate || 0).toFixed(2)}</Text>
              {inningsNum === 1 && match?.totalOvers && (
                <Text className="text-blue-200 text-xs">
                  Proj: {Math.round((cs.currentRate || 0) * match.totalOvers)}
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      {/* Batsmen & Bowler row */}
      {!compact && cs.striker && (
        <View className="flex-row mt-3 gap-2">
          <View className="flex-1 bg-white/10 rounded-lg px-2 py-1">
            <Text className="text-white text-xs font-semibold" numberOfLines={1}>
              {cs.striker?.name || '—'} *
            </Text>
            {inningsSummary?.batting?.find((b: any) => b.playerId === (cs.striker?._id || cs.striker)) && (
              <Text className="text-accent text-xs">
                {inningsSummary.batting.find((b: any) => b.playerId === (cs.striker?._id || cs.striker))?.runs}(
                {inningsSummary.batting.find((b: any) => b.playerId === (cs.striker?._id || cs.striker))?.balls})
              </Text>
            )}
          </View>
          <View className="flex-1 bg-white/10 rounded-lg px-2 py-1">
            <Text className="text-white text-xs font-semibold" numberOfLines={1}>
              {cs.nonStriker?.name || '—'}
            </Text>
          </View>
          <View className="flex-1 bg-white/10 rounded-lg px-2 py-1">
            <Text className="text-blue-200 text-xs" numberOfLines={1}>
              {cs.currentBowler?.name || '—'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
