import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/Engine';
import { GameState, BuildingType, UnitType } from './game/types';
import { COSTS, BUILD_TIMES } from './game/constants';
import { audio } from './game/Audio';
import { keyboardManager } from './game/keyboard';
import { TouchManager, TouchAction } from './game/touch';
import { PerformanceMetrics } from './game/performance';
import { saveGame, loadGame, getSaveList, deleteSave, autoSave, loadAutoSave, hasAutoSave, SaveMeta, saveSettings, loadSettings, GameSettings, serializeGameState, SerializedGameState } from './game/saveLoad';
import { saveReplay, getReplayList, loadReplay, deleteReplay, ReplayMeta } from './game/replay';
import { Difficulty } from './game/config';
import { Building, Unit, Ore } from './game/entities';
import { Zap, Coins, Hammer, Crosshair, Factory, Shield, Battery, Tractor, Users, type LucideIcon, Save, FolderOpen, Trash2, Play, Gauge, Settings } from 'lucide-react';

const STRUCTURES: { type: BuildingType; label: string; icon: LucideIcon }[] = [
  { type: 'powerplant', label: 'Power Plant', icon: Battery },
  { type: 'refinery', label: 'Ore Refinery', icon: Factory },
  { type: 'barracks', label: 'Barracks', icon: Shield },
  { type: 'warfactory', label: 'War Factory', icon: Hammer },
  { type: 'turret', label: 'Defense Turret', icon: Crosshair },
];

const UNITS: { type: UnitType; label: string; icon: LucideIcon }[] = [
  { type: 'harvester', label: 'Harvester', icon: Tractor },
  { type: 'infantry', label: 'Infantry', icon: Users },
  { type: 'tank', label: 'Light Tank', icon: Crosshair },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<'structures' | 'units'>('structures');
  const [demoMode, setDemoMode] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);

  // New state for world-class features
  const [fps, setFps] = useState(0);
  const [showFps, setShowFps] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [saveList, setSaveList] = useState<SaveMeta[]>([]);
  const [replayList, setReplayList] = useState<ReplayMeta[]>([]);
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics | null>(null);
  const [entityCount, setEntityCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const touchManagerRef = useRef<TouchManager | null>(null);

  // Load settings on mount
  useEffect(() => {
    const settings = loadSettings();
    setShowFps(settings.showFps);
    setDifficulty(settings.difficulty);
  }, []);

  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = window.innerWidth - 280;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const newEngine = new GameEngine(canvas, setGameState);
    newEngine.start();
    newEngine.setDifficulty(difficulty);
    setEngine(newEngine);

    // Initialize keyboard
    keyboardManager.init();

    // Initialize touch
    const touchManager = new TouchManager();
    touchManager.init(canvas, newEngine.camera);
    touchManagerRef.current = touchManager;

    touchManager.setOnAction((action: TouchAction) => {
      if (action.type === 'select') {
        // Simulate right-click for touch command
        newEngine.commandSelectedUnits(action.worldX, action.worldY);
      } else if (action.type === 'pan') {
        // Camera panning via touch drag handled internally
      }
    });

    touchManager.setOnLongPress((worldX, worldY) => {
      // Long press = attack move
      newEngine.commandSelectedUnits(worldX, worldY);
    });

    // Keyboard bindings
    const unsubFps = keyboardManager.on('toggleFps', () => {
      setShowFps(prev => {
        const next = !prev;
        const settings = loadSettings();
        settings.showFps = next;
        saveSettings(settings);
        return next;
      });
    });

    const unsubSave = keyboardManager.on('saveGame', () => {
      handleSave('quicksave');
    });

    const unsubLoad = keyboardManager.on('loadGame', () => {
      handleLoad('quicksave');
    });

    const unsubDemo = keyboardManager.on('startDemo', () => {
      if (!demoMode) startDemo();
    });

    const unsubReplay = keyboardManager.on('toggleReplay', () => {
      setShowReplays(prev => !prev);
    });

    // Performance monitoring interval
    const perfInterval = setInterval(() => {
      if (engine) {
        const metrics = engine.getPerformanceMetrics();
        setFps(metrics.fps);
        setPerfMetrics(metrics);
        setEntityCount(metrics.entityCount);
      }
    }, 500);

    // Autosave every 30 seconds
    const autosaveInterval = setInterval(() => {
      if (engine && gameState) {
        try {
          const { serializeGameState } = require('./game/saveLoad');
          const serialized = serializeGameState(
            gameState,
            engine.buildings,
            engine.units,
            engine.ores,
            engine.buildQueue,
            engine.placingBuilding,
            engine.aiState,
            engine.aiTimer,
            engine.aiScoutedBase,
            engine.camera,
            engine.gameTime,
          );
          autoSave(serialized);
        } catch (e) {
          // Ignore autosave errors
        }
      }
    }, 30000);

    return () => {
      newEngine.stop();
      window.removeEventListener('resize', resize);
      keyboardManager.destroy();
      touchManager.destroy();
      unsubFps();
      unsubSave();
      unsubLoad();
      unsubDemo();
      unsubReplay();
      clearInterval(perfInterval);
      clearInterval(autosaveInterval);
    };
  }, []);

  // Update difficulty on engine when changed
  useEffect(() => {
    if (engine) {
      engine.setDifficulty(difficulty);
    }
    const settings = loadSettings();
    settings.difficulty = difficulty;
    saveSettings(settings);
  }, [difficulty]);

  const startDemo = () => {
    setDemoMode(true);
    setWinner(null);
    if (engine) {
      engine.startDemo();
      engine.startRecording();
      setIsRecording(true);
    }
  };

  const stopDemo = () => {
    setDemoMode(false);
    setWinner(null);
    if (engine) {
      engine.stopDemo();
      const replay = engine.stopRecording();
      setIsRecording(false);
      // Auto-save replay
      try {
        const name = `replay_${Date.now()}`;
        saveReplay(name, replay);
        setReplayList(getReplayList());
      } catch (e) {
        // Ignore replay save errors
      }
    }
  };

  const handleSave = (name: string) => {
    if (!engine || !gameState) return;
    try {
      const serialized = serializeGameState(
        gameState,
        engine.buildings,
        engine.units,
        engine.ores,
        engine.buildQueue,
        engine.placingBuilding,
        engine.aiState,
        engine.aiTimer,
        engine.aiScoutedBase,
        engine.camera,
        engine.gameTime,
      );
      saveGame(name, serialized);
      setSaveList(getSaveList());
      audio.playPlace();
    } catch (e) {
      audio.playError();
    }
  };

  const handleLoad = (name: string) => {
    if (!engine) return;
    try {
      const save = loadGame(name);
      engine.players = save.players;
      engine.buildings = save.buildings.map(b => {
        const bldg = new Building(b.x, b.y, b.type, b.player);
        bldg.id = b.id;
        bldg.hp = b.hp;
        bldg.maxHp = b.maxHp;
        bldg.active = b.active;
        bldg.cooldown = b.cooldown;
        return bldg;
      });
      engine.units = save.units.map(u => {
        const unit = new Unit(u.x, u.y, u.type, u.player);
        unit.id = u.id;
        unit.hp = u.hp;
        unit.maxHp = u.maxHp;
        unit.state = u.state as any;
        unit.cooldown = u.cooldown;
        unit.load = u.load;
        return unit;
      });
      engine.ores = save.ores.map(o => {
        const ore = new Ore(o.x, o.y);
        ore.id = o.id;
        ore.amount = o.amount;
        return ore;
      });
      engine.buildQueue = save.buildQueue;
      engine.placingBuilding = save.placingBuilding;
      engine.aiState = save.aiState as any;
      engine.aiTimer = save.aiTimer;
      engine.aiScoutedBase = save.aiScoutedBase;
      engine.camera = save.camera;
      engine.gameTime = save.gameTime;
      engine.updateReactState();
      audio.playPlace();
    } catch (e) {
      audio.playError();
    }
  };

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

        {/* FPS & Performance Overlay */}
        {showFps && perfMetrics && (
          <div className="absolute top-2 right-2 bg-black/80 border border-emerald-800 px-3 py-2 text-xs font-mono z-50 rounded">
            <div className="flex items-center gap-2">
              <Gauge size={12} className={perfMetrics.fps < 30 ? 'text-red-500' : 'text-emerald-400'} />
              <span className={perfMetrics.fps < 30 ? 'text-red-400' : 'text-emerald-400'}>
                {perfMetrics.fps} FPS
              </span>
            </div>
            <div className="text-zinc-500 mt-1">
              Entities: {entityCount} | {Math.round(perfMetrics.avgFrameTime * 100) / 100}ms
            </div>
            {perfMetrics.memoryUsage && (
              <div className="text-zinc-500">
                Memory: {(perfMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
              </div>
            )}
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-900/80 border border-red-500 px-3 py-1 rounded z-50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-red-300 text-xs font-bold">REC</span>
          </div>
        )}

        {/* Demo Mode Banner */}
        {demoMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 px-6 py-2 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-red-300 font-bold text-sm uppercase tracking-wider">AI Battle Live</span>
              </div>
              <button
                onClick={stopDemo}
                className="text-xs bg-red-800 hover:bg-red-700 px-3 py-1 rounded text-red-200 font-bold"
              >
                STOP
              </button>
            </div>
          </div>
        )}

        {/* Start Demo Button */}
        {!demoMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={startDemo}
              className="bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-500 px-6 py-3 rounded-lg text-emerald-300 font-bold text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-lg shadow-emerald-900/50"
            >
              ▶ Watch AI vs AI
            </button>
          </div>
        )}

        {/* Save/Load Modal */}
        {showSaveLoad && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border-2 border-emerald-700 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-emerald-400 font-bold text-lg">Save / Load</h2>
                <button onClick={() => setShowSaveLoad(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleSave(`save_${Date.now()}`)}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                >
                  <Save size={16} /> Quick Save
                </button>
                {hasAutoSave() && (
                  <button
                    onClick={() => handleLoad('autosave')}
                    className="w-full bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                  >
                    <FolderOpen size={16} /> Load Autosave
                  </button>
                )}
                <hr className="border-zinc-700 my-3" />
                <h3 className="text-zinc-400 text-sm font-bold">Saved Games</h3>
                {saveList.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No saved games</p>
                ) : (
                  saveList.map(save => (
                    <div key={save.name} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                      <div className="flex-1">
                        <div className="text-xs text-zinc-300">{save.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(save.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleLoad(save.name)}
                          className="text-emerald-400 hover:text-emerald-300 p-1"
                        >
                          <FolderOpen size={14} />
                        </button>
                        <button
                          onClick={() => { deleteSave(save.name); setSaveList(getSaveList()); }}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Replays Modal */}
        {showReplays && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border-2 border-emerald-700 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-emerald-400 font-bold text-lg">Replays</h2>
                <button onClick={() => setShowReplays(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              {replayList.length === 0 ? (
                <p className="text-zinc-500 text-sm">No replays saved</p>
              ) : (
                <div className="space-y-2">
                  {replayList.map(replay => (
                    <div key={replay.name} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                      <div className="flex-1">
                        <div className="text-xs text-zinc-300">{replay.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {Math.round(replay.duration / 1000)}s • {replay.frameCount} frames
                          {replay.winner && ` • Winner: P${replay.winner}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const r = loadReplay(replay.name);
                            if (r) {
                              // Play replay - would need replay viewer component
                              alert('Replay viewer coming soon!');
                            }
                          }}
                          className="text-emerald-400 hover:text-emerald-300 p-1"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => { deleteReplay(replay.name); setReplayList(getReplayList()); }}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border-2 border-emerald-700 rounded-lg p-6 w-96">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-emerald-400 font-bold text-lg">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-zinc-300 text-sm font-bold block mb-2">AI Difficulty</label>
                  <div className="flex gap-2">
                    {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase ${
                          difficulty === d
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 text-sm font-bold">Show FPS</label>
                  <button
                    onClick={() => {
                      setShowFps(!showFps);
                      const s = loadSettings();
                      s.showFps = !showFps;
                      saveSettings(s);
                    }}
                    className={`w-12 h-6 rounded-full ${showFps ? 'bg-emerald-600' : 'bg-zinc-700'} relative transition-colors`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${showFps ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="text-zinc-500 text-xs">
                  <div className="font-bold mb-1">Keyboard Shortcuts:</div>
                  <div>WASD - Pan camera</div>
                  <div>1-8 - Build units/structures</div>
                  <div>F - Toggle FPS</div>
                  <div>R - Start/stop demo</div>
                  <div>T - Toggle replays</div>
                  <div>Ctrl+S - Save game</div>
                  <div>Ctrl+L - Load game</div>
                  <div>Space - Stop selected units</div>
                </div>
              </div>
            </div>
          </div>
        )}

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

            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="bg-zinc-900/80 border border-zinc-700 p-2 rounded hover:border-emerald-600 transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={() => { setShowSaveLoad(true); setSaveList(getSaveList()); }}
                className="bg-zinc-900/80 border border-zinc-700 p-2 rounded hover:border-emerald-600 transition-colors"
                title="Save/Load"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => { setShowReplays(true); setReplayList(getReplayList()); }}
                className="bg-zinc-900/80 border border-zinc-700 p-2 rounded hover:border-emerald-600 transition-colors"
                title="Replays"
              >
                <Play size={16} />
              </button>
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

interface BuildButtonProps {
  item: { type: BuildingType | UnitType; label: string; icon: LucideIcon };
  cost: number;
  time: number;
  engine: GameEngine | null;
  gameState: GameState;
  playerCredits: number;
  unlocked?: boolean;
}

function BuildButton({ item, cost, time, engine, gameState, playerCredits, unlocked = true }: BuildButtonProps) {
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
        engine.placingBuilding = item.type as unknown as BuildingType;
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
