import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/Engine';
import { GameState, BuildingType, UnitType } from './game/types';
import { COSTS, BUILD_TIMES } from './game/constants';
import { audio } from './game/Audio';
import { Zap, Coins, Hammer, Crosshair, Factory, Shield, Battery, Tractor, Users } from 'lucide-react';

const STRUCTURES: { type: BuildingType; label: string; icon: any }[] = [
  { type: 'powerplant', label: 'Power Plant', icon: Battery },
  { type: 'refinery', label: 'Ore Refinery', icon: Factory },
  { type: 'barracks', label: 'Barracks', icon: Shield },
  { type: 'warfactory', label: 'War Factory', icon: Hammer },
  { type: 'turret', label: 'Defense Turret', icon: Crosshair },
];

const UNITS: { type: UnitType; label: string; icon: any }[] = [
  { type: 'harvester', label: 'Harvester', icon: Tractor },
  { type: 'infantry', label: 'Infantry', icon: Users },
  { type: 'tank', label: 'Light Tank', icon: Crosshair },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<'structures' | 'units'>('structures');

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    const resize = () => {
      canvas.width = window.innerWidth - 280; // Sidebar width
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const newEngine = new GameEngine(canvas, setGameState);
    newEngine.start();
    setEngine(newEngine);

    return () => {
      newEngine.stop();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const player = gameState?.players[1];
  const powerWarning = player ? player.power > player.maxPower : false;

  const playerBuildings = engine?.buildings.filter(b => b.player === 1) || [];
  const hasBarracks = playerBuildings.some(b => b.type === 'barracks');
  const hasWarFactory = playerBuildings.some(b => b.type === 'warfactory');
  const hasRefinery = playerBuildings.some(b => b.type === 'refinery');

  return (
    <div 
      className="flex h-screen overflow-hidden bg-black text-emerald-400 font-mono select-none crt"
      onClick={() => audio.init()}
    >
      {/* Game Canvas */}
      <div className="flex-1 relative">
        <canvas 
          ref={canvasRef} 
          className="block w-full h-full cursor-crosshair"
          onContextMenu={(e) => e.preventDefault()}
        />
        
        {!gameState && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center z-50">
            Loading...
          </div>
        )}
        
        {/* Top HUD */}
        {player && (
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex justify-between items-start z-40">
            <div className="flex gap-6 metal-panel p-3 pointer-events-auto">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                <Coins size={20} />
                <span>${player.credits.toLocaleString()}</span>
              </div>
              <div className={`flex items-center gap-2 font-bold text-lg ${powerWarning ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                <Zap size={20} />
                <span>{player.power} / {player.maxPower}</span>
              </div>
            </div>
            
            {powerWarning && (
              <div className="bg-red-900/80 text-red-400 border-2 border-red-500 px-4 py-2 font-bold animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                LOW POWER
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar (C&C Style) */}
      <div className="w-[280px] metal-panel flex flex-col shadow-2xl z-40 border-l-4 border-zinc-600">
        {/* Minimap Placeholder */}
        <div className="h-[200px] bg-black border-b-4 border-zinc-800 p-2 flex flex-col">
          <div className="w-full flex-1 border-2 border-emerald-800 radar-bg flex items-center justify-center text-emerald-600 text-xs uppercase tracking-widest shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
            Radar Offline
          </div>
          
          {/* Active Production Display */}
          {gameState?.buildQueue && (
            <div className="mt-2 p-2 bg-zinc-900 border border-zinc-700 rounded flex items-center gap-3">
              <div className="text-emerald-400">
                <Hammer size={16} className={gameState.buildQueue.status === 'building' ? 'animate-bounce' : ''} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1">
                  {gameState.buildQueue.status === 'building' ? 'Constructing...' : 'Ready to Place'}
                </div>
                <div className="text-xs text-emerald-400 font-bold uppercase truncate">
                  {[...STRUCTURES, ...UNITS].find(i => i.type === gameState.buildQueue!.type)?.label || gameState.buildQueue.type}
                </div>
                {gameState.buildQueue.status === 'building' && (
                  <div className="w-full h-1 bg-zinc-800 mt-1 rounded overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${(gameState.buildQueue.progress / BUILD_TIMES[gameState.buildQueue.type]) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b-4 border-zinc-800 bg-zinc-900">
          <button 
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors metal-button ${activeTab === 'structures' ? 'active-tab' : 'text-zinc-400'}`}
            onClick={() => { setActiveTab('structures'); audio.playClick(); }}
          >
            Structures
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors metal-button ${activeTab === 'units' ? 'active-tab' : 'text-zinc-400'}`}
            onClick={() => { setActiveTab('units'); audio.playClick(); }}
          >
            Units
          </button>
        </div>

        {/* Build Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start">
          {gameState && player && activeTab === 'structures' && STRUCTURES.map(item => (
            <BuildButton 
              key={item.type}
              item={item}
              cost={COSTS[item.type]}
              time={BUILD_TIMES[item.type]}
              engine={engine}
              gameState={gameState}
              playerCredits={player.credits}
            />
          ))}
          {gameState && player && activeTab === 'units' && UNITS.map(item => {
            const isUnlocked = 
              item.type === 'infantry' ? hasBarracks :
              item.type === 'tank' ? hasWarFactory :
              item.type === 'harvester' ? (hasWarFactory || hasRefinery) : true;

            return (
              <BuildButton 
                key={item.type}
                item={item}
                cost={COSTS[item.type]}
                time={BUILD_TIMES[item.type]}
                engine={engine}
                gameState={gameState}
                playerCredits={player.credits}
                unlocked={isUnlocked}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BuildButton({ item, cost, time, engine, gameState, playerCredits, unlocked = true }: any) {
  const isBuildingThis = gameState.buildQueue?.type === item.type;
  const isBuildingOther = gameState.buildQueue && !isBuildingThis;
  const isReady = isBuildingThis && gameState.buildQueue.status === 'ready';
  const progress = isBuildingThis ? (gameState.buildQueue.progress / time) * 100 : 0;
  
  const canAfford = playerCredits >= cost;
  const disabled = isBuildingOther || (!canAfford && !isBuildingThis) || !unlocked;

  const handleClick = () => {
    if (!engine || !unlocked) return;
    
    if (disabled && !isReady) {
      audio.playError();
      return;
    }

    if (isReady) {
      // If it's a structure, start placing it
      if (['powerplant', 'refinery', 'barracks', 'warfactory', 'turret'].includes(item.type)) {
        engine.placingBuilding = item.type;
        engine.updateReactState();
        audio.playClick();
      }
    } else if (!isBuildingThis && canAfford) {
      engine.startBuilding(item.type);
      audio.playClick();
    }
  };

  const isPlacing = gameState.placingBuilding === item.type;

  return (
    <button
      onClick={handleClick}
      disabled={disabled && !isReady}
      className={`
        relative aspect-square metal-button flex flex-col items-center justify-center gap-2 overflow-hidden transition-all
        ${isPlacing ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : ''}
        ${isReady && !isPlacing ? 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : ''}
        ${!isReady && !isPlacing && !disabled ? '' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {/* Progress Overlay */}
      {isBuildingThis && !isReady && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-emerald-500/30 transition-all duration-100"
          style={{ height: `${progress}%` }}
        />
      )}

      <item.icon size={28} className={isReady ? 'text-emerald-400' : (unlocked ? 'text-zinc-400' : 'text-zinc-700')} />
      <div className={`text-[10px] font-bold uppercase tracking-wider text-center px-1 z-10 ${unlocked ? 'text-zinc-300' : 'text-zinc-600'}`}>
        {item.label}
      </div>
      <div className={`text-[10px] font-bold z-10 ${unlocked ? 'text-emerald-500' : 'text-zinc-700'}`}>
        ${cost}
      </div>

      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-[1px] text-xs font-bold text-red-500 uppercase tracking-widest border-2 border-zinc-800">
          LOCKED
        </div>
      )}

      {isReady && !isPlacing && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/80 backdrop-blur-[1px] text-xs font-bold text-emerald-400 uppercase tracking-widest animate-pulse border-2 border-emerald-500">
          Ready
        </div>
      )}
    </button>
  );
}
