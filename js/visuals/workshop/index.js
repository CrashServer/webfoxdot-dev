// ── Workshop layer registry ──────────────────────────────────────────────────
//
// GENERATED from the stars/workshop VJ tool's src/channel.js LAYER_KINDS table.
// Do not hand-edit the list: re-run tools/gen-workshop-registry.py against the
// workshop source when layers are added there.
//
// A workshop layer is a different animal from a crashDot scene, and both are kept.
// A crashDot scene is a SCALAR FIELD — field(u,v,t,p,a) → 0..1 — coloured by a
// palette and mirrored into GLSL so it can run per-pixel on the GPU. A workshop
// layer is an imperative RGBA DRAW — draw(ctx,w,h,p,t) — that owns its own colour
// and its own state. Neither can be expressed as the other, so the renderer grew a
// second layer kind rather than trying to translate 206 of these into fields.
//
// makeParams() returns descriptors ({ base, min, max, mod }), not values; the
// workshop resolves them through its own modulation matrix. crashDot resolves
// params through vlang (patterns and TimeVars on the audio clock) and hands the
// draw function plain numbers, so defaults() flattens a descriptor set to the
// numbers a draw call expects.

import { apollonianParams, drawApollonian } from './layers/apollonian.js';
import { arabesqueParams, drawArabesque } from './layers/arabesque.js';
import { arcDischargeParams, drawArcDischarge } from './layers/arcDischarge.js';
import { asciiFireParams, drawAsciiFire } from './layers/asciiFire.js';
import { asciiPlasmaParams, drawAsciiPlasma } from './layers/asciiPlasma.js';
import { asciiRadarParams, drawAsciiRadar } from './layers/asciiRadar.js';
import { asciiWaveformParams, drawAsciiWaveform } from './layers/asciiWaveform.js';
import { attractorParams, drawAttractor } from './layers/attractor.js';
import { audioTerrainParams, drawAudioTerrain } from './layers/audioTerrain.js';
import { auroraParams, drawAurora } from './layers/aurora.js';
import { beatCreaturesParams, drawBeatCreatures } from './layers/beatCreatures.js';
import { binaryRainParams, drawBinaryRain } from './layers/binaryRain.js';
import { bioSpineParams, drawBioSpine } from './layers/bioSpine.js';
import { biosPostParams, drawBiosPost } from './layers/biosPost.js';
import { blackParams, drawBlack } from './layers/black.js';
import { bloodSplatterParams, drawBloodSplatter } from './layers/bloodSplatter.js';
import { bodyHorrorParams, drawBodyHorror } from './layers/bodyHorror.js';
import { boidsParams, drawBoids } from './layers/boids.js';
import { boidsTrailsParams, drawBoidsTrails } from './layers/boidsTrails.js';
import { breakingOverlayParams, drawBreakingOverlay } from './layers/breakingOverlay.js';
import { bubblesFloatParams, drawBubblesFloat } from './layers/bubblesFloat.js';
import { burningShipParams, drawBurningShip } from './layers/burningShip.js';
import { bzReactionParams, drawBzReaction } from './layers/bzReaction.js';
import { chladniPlateParams, drawChladniPlate } from './layers/chladniPlate.js';
import { circuitBoardParams, drawCircuitBoard } from './layers/circuitBoard.js';
import { circuitScannerParams, drawCircuitScanner } from './layers/circuitScanner.js';
import { cityOsmParams, drawCityOsm } from './layers/cityOsm.js';
import { cliffordParams, drawClifford } from './layers/clifford.js';
import { cliftSceneParams, drawCliftScene } from './layers/cliftScene.js';
import { clockFaceParams, drawClockFace } from './layers/clockFace.js';
import { codeComicParams, drawCodeComic } from './layers/codeComic.js';
import { codeConspiracyParams, drawCodeConspiracy } from './layers/codeConspiracy.js';
import { codeFullParams, drawCodeFull } from './layers/codeFull.js';
import { comicPanelsParams, drawComicPanels } from './layers/comicPanels.js';
import { constellationParams, drawConstellation } from './layers/constellation.js';
import { coralBranchParams, drawCoralBranch } from './layers/coralBranch.js';
import { countdownParams, drawCountdown } from './layers/countdown.js';
import { cpuHeatParams, drawCpuHeat } from './layers/cpuHeat.js';
import { crashServerParams, drawCrashServer } from './layers/crashServer.js';
import { cricBombingParams, drawCricBombing } from './layers/cricBombing.js';
import { cricWifiAttackParams, drawCricWifiAttack } from './layers/cricWifiAttack.js';
import { crystalGrowthParams, drawCrystalGrowth } from './layers/crystalGrowth.js';
import { crystalLatticeParams, drawCrystalLattice } from './layers/crystalLattice.js';
import { cubeFieldParams, drawCubeField } from './layers/cubeField.js';
import { curlFlowParams, drawCurlFlow } from './layers/curlFlow.js';
import { cyberpunkWorldParams, drawCyberpunkWorld } from './layers/cyberpunkWorld.js';
import { cyclicCAParams, drawCyclicCA } from './layers/cyclicCA.js';
import { cymaticsParams, drawCymatics } from './layers/cymatics.js';
import { dancePartyParams, drawDanceParty } from './layers/danceParty.js';
import { dataPulseParams, drawDataPulse } from './layers/dataPulse.js';
import { diffGrowthParams, drawDiffGrowth } from './layers/diffGrowth.js';
import { dnaHelixParams, drawDNAHelix } from './layers/dnaHelix.js';
import { dnaSequenceParams, drawDnaSequence } from './layers/dnaSequence.js';
import { doomCorridorParams, drawDoomCorridor } from './layers/doomCorridor.js';
import { drawDrosteFeedback, drosteFeedbackParams } from './layers/drosteFeedback.js';
import { drawElasticGrid, elasticGridParams } from './layers/elasticGrid.js';
import { drawEvalSeismograph, evalSeismographParams } from './layers/evalSeismograph.js';
import { drawEvolutionPlayground, evolutionPlaygroundParams } from './layers/evolutionPlayground.js';
import { drawFallingSand, fallingSandParams } from './layers/fallingSand.js';
import { drawFerrofluid, ferrofluidParams } from './layers/ferrofluid.js';
import { drawFilmLeader, filmLeaderParams } from './layers/filmLeader.js';
import { drawFire, fireParams } from './layers/fire.js';
import { drawFlickerFilm, flickerFilmParams } from './layers/flickerFilm.js';
import { drawFlowField, flowFieldParams } from './layers/flowField.js';
import { drawFlowerOfLife, flowerOfLifeParams } from './layers/flowerOfLife.js';
import { drawFpvDrone, fpvDroneParams } from './layers/fpvDrone.js';
import { drawFractalKaleidoscope, fractalKaleidoscopeParams } from './layers/fractalKaleidoscope.js';
import { drawFractalTree, fractalTreeParams } from './layers/fractalTree.js';
import { drawFreqMatrix, freqMatrixParams } from './layers/freqMatrix.js';
import { drawFreqTower, freqTowerParams } from './layers/freqtower.js';
import { drawGalaxySpiral, galaxySpiralParams } from './layers/galaxySpiral.js';
import { drawGifBank, gifBankParams } from './layers/gifBank.js';
import { drawGlitchStorm, glitchStormParams } from './layers/glitchStorm.js';
import { drawGlitchWord, glitchWordParams } from './layers/glitchWord.js';
import { drawGolGame, golGameParams } from './layers/golGame.js';
import { drawGrid, gridParams } from './layers/grid.js';
import { drawGyroidSlice, gyroidSliceParams } from './layers/gyroidSlice.js';
import { drawHexDump, hexDumpParams } from './layers/hexDump.js';
import { drawHexGrid, hexGridParams } from './layers/hexGrid.js';
import { drawHitomezashi, hitomezashiParams } from './layers/hitomezashi.js';
import { drawHolographicWave, holographicWaveParams } from './layers/holographicWave.js';
import { drawHyperbolicTile, hyperbolicTileParams } from './layers/hyperbolicTile.js';
import { drawHyperspace, hyperspaceParams } from './layers/hyperspace.js';
import { drawHypnoscope, hypnoscopeParams } from './layers/hypnoscope.js';
import { drawIceCave, iceCaveParams } from './layers/iceCave.js';
import { drawIfsFractal, ifsFractalParams } from './layers/ifsFractal.js';
import { drawIkedaBarcode, ikedaBarcodeParams } from './layers/ikedaBarcode.js';
import { drawIkedaCircuit, ikedaCircuitParams } from './layers/ikedaCircuit.js';
import { drawIkedaCoords, ikedaCoordsParams } from './layers/ikedaCoords.js';
import { drawIkedaDots, ikedaDotsParams } from './layers/ikedaDots.js';
import { drawIkedaMatrix, ikedaMatrixParams } from './layers/ikedaMatrix.js';
import { drawIkedaOscillo, ikedaOscilloParams } from './layers/ikedaOscillo.js';
import { drawIkedaScan, ikedaScanParams } from './layers/ikedaScan.js';
import { drawImpactText, impactTextParams } from './layers/impactText.js';
import { drawInkBlot, inkBlotParams } from './layers/inkBlot.js';
import { drawInstrumentPop, instrumentPopParams } from './layers/instrumentPop.js';
import { drawInterference, interferenceParams } from './layers/interference.js';
import { drawJuliaCycles, juliaCyclesParams } from './layers/juliaCycles.js';
import { drawKaliTunnel, kaliTunnelParams } from './layers/kaliTunnel.js';
import { drawLSystem, lSystemParams } from './layers/lSystem.js';
import { drawLangtonsAnt, langtonsAntParams } from './layers/langtonsAnt.js';
import { drawLaserShow, laserShowParams } from './layers/laserShow.js';
import { drawLavaLamp, lavaLampParams } from './layers/lavaLamp.js';
import { drawLissajous, lissajousParams } from './layers/lissajous.js';
import { drawLiveCode, liveCodeParams } from './layers/liveCode.js';
import { drawLorenzSystem, lorenzSystemParams } from './layers/lorenzSystem.js';
import { drawMagicCircle, magicCircleParams } from './layers/magicCircle.js';
import { drawMagneticField, magneticFieldParams } from './layers/magneticField.js';
import { drawMandelbox, mandelboxParams } from './layers/mandelbox.js';
import { drawMandelbulb, mandelbulbParams } from './layers/mandelbulb.js';
import { drawMastoFeed, mastoFeedParams } from './layers/mastoFeed.js';
import { drawMathSymbols, mathSymbolsParams } from './layers/mathSymbols.js';
import { drawMatrixRain, matrixRainParams } from './layers/matrixRain.js';
import { drawMazeCity, mazeCityParams } from './layers/mazeCity.js';
import { drawMedia, mediaParams } from './layers/media.js';
import { drawMetaballs, metaballsParams } from './layers/metaballs.js';
import { drawMobiusStrip, mobiusStripParams } from './layers/mobiusStrip.js';
import { drawMoirePattern, moirePatternParams } from './layers/moirePattern.js';
import { drawMorphShape, morphShapeParams } from './layers/morphShape.js';
import { drawMycelium, myceliumParams } from './layers/mycelium.js';
import { drawNebulaDust, nebulaDustParams } from './layers/nebulaDust.js';
import { drawNeonCity, neonCityParams } from './layers/neonCity.js';
import { drawNeonGrid3D, neonGrid3DParams } from './layers/neonGrid3D.js';
import { drawNeonSign, neonSignParams } from './layers/neonSign.js';
import { drawNeuralNet, neuralNetParams } from './layers/neuralNet.js';
import { drawNewsTicker, newsTickerParams } from './layers/newsTicker.js';
import { drawNewtonFractal, newtonFractalParams } from './layers/newtonFractal.js';
import { drawNoise, noiseParams } from './layers/noise.js';
import { drawNuclearBlast, nuclearBlastParams } from './layers/nuclearBlast.js';
import { drawOceanData, oceanDataParams } from './layers/oceanData.js';
import { drawOrbitSystem, orbitSystemParams } from './layers/orbitSystem.js';
import { drawOrganicMachine, organicMachineParams } from './layers/organicMachine.js';
import { drawOrganicMorphing, organicMorphingParams } from './layers/organicMorphing.js';
import { drawParticleBurst, particleBurstParams } from './layers/particleBurst.js';
import { drawPendulum, pendulumParams } from './layers/pendulum.js';
import { drawPendulumWave, pendulumWaveParams } from './layers/pendulumWave.js';
import { drawPhyllotaxis, phyllotaxisParams } from './layers/phyllotaxis.js';
import { drawPixelSort, pixelSortParams } from './layers/pixelSort.js';
import { drawPlasma, plasmaParams } from './layers/plasma.js';
import { drawPlatonicSolid, platonicSolidParams } from './layers/platonicSolid.js';
import { drawPolarMandala, polarMandalaParams } from './layers/polarMandala.js';
import { drawPong, pongParams } from './layers/pong.js';
import { drawPrismLight, prismLightParams } from './layers/prismLight.js';
import { drawPropagandaPoster, propagandaPosterParams } from './layers/propagandaPoster.js';
import { drawPunkStatic, punkStaticParams } from './layers/punkStatic.js';
import { drawQuantumAscii, quantumAsciiParams } from './layers/quantumAscii.js';
import { drawQuantumWave, quantumWaveParams } from './layers/quantumWave.js';
import { drawQuasicrystal, quasicrystalParams } from './layers/quasicrystal.js';
import { drawRadarSweep, radarSweepParams } from './layers/radarSweep.js';
import { drawRansomEval, ransomEvalParams } from './layers/ransomEval.js';
import { drawReactionDiffusion, reactionDiffusionParams } from './layers/reactionDiffusion.js';
import { drawRedRoom, redRoomParams } from './layers/redRoom.js';
import { drawResistanceNet, resistanceNetParams } from './layers/resistanceNet.js';
import { drawRhizome, rhizomeParams } from './layers/rhizome.js';
import { drawRibbonFlow, ribbonFlowParams } from './layers/ribbonFlow.js';
import { drawRings, ringsParams } from './layers/rings.js';
import { drawRuneCircle, runeCircleParams } from './layers/runeCircle.js';
import { drawSandDune, sandDuneParams } from './layers/sandDune.js';
import { drawSandpile, sandpileParams } from './layers/sandpile.js';
import { drawScratchFilm, scratchFilmParams } from './layers/scratchFilm.js';
import { drawScrollingText, scrollingTextParams } from './layers/scrollingText.js';
import { drawSeaWaves, seaWavesParams } from './layers/seaWaves.js';
import { drawSevenSegment, sevenSegmentParams } from './layers/sevenSegment.js';
import { drawShapes, shapesParams } from './layers/shapes.js';
import { drawSlimeMold, slimeMoldParams } from './layers/slimeMold.js';
import { drawSpectrogramScroll, spectrogramScrollParams } from './layers/spectrogramScroll.js';
import { drawSpectrum, spectrumParams } from './layers/spectrum.js';
import { drawSphere3D, sphere3dParams } from './layers/sphere3d.js';
import { drawSpirograph, spirographParams } from './layers/spirograph.js';
import { drawSplineWeave, splineWeaveParams } from './layers/splineWeave.js';
import { drawStarNest, starNestParams } from './layers/starNest.js';
import { drawStarburst, starburstParams } from './layers/starburst.js';
import { drawStarfield, starfieldParams } from './layers/starfield.js';
import { drawStockTicker, stockTickerParams } from './layers/stockTicker.js';
import { drawStringArt, stringArtParams } from './layers/stringArt.js';
import { drawSupershape, supershapeParams } from './layers/supershape.js';
import { drawSurveillance, surveillanceParams } from './layers/surveillance.js';
import { drawSwarmIntelligence, swarmIntelligenceParams } from './layers/swarmIntelligence.js';
import { drawSysMonitor, sysMonitorParams } from './layers/sysMonitor.js';
import { drawSystemBoot, systemBootParams } from './layers/systemBoot.js';
import { drawSystemGauge, systemGaugeParams } from './layers/systemGauge.js';
import { drawTerminalPrompt, terminalPromptParams } from './layers/terminalPrompt.js';
import { drawTesseract, tesseractParams } from './layers/tesseract.js';
import { drawTestPattern, testPatternParams } from './layers/testpattern.js';
import { drawText, textParams } from './layers/text.js';
import { drawTileFlip, tileFlipParams } from './layers/tileFlip.js';
import { drawToonEQ, toonEQParams } from './layers/toonEQ.js';
import { drawTorusKnot, torusKnotParams } from './layers/torusKnot.js';
import { drawTronTunnel, tronTunnelParams } from './layers/tronTunnel.js';
import { drawTruchetTiles, truchetTilesParams } from './layers/truchetTiles.js';
import { drawTunnel, tunnelParams } from './layers/tunnel.js';
import { drawTuringPattern, turingPatternParams } from './layers/turingPattern.js';
import { drawTypoBurst, typoBurstParams } from './layers/typoBurst.js';
import { drawUlamSpiral, ulamSpiralParams } from './layers/ulamSpiral.js';
import { drawVhsStatic, vhsStaticParams } from './layers/vhsStatic.js';
import { drawVirusSpread, virusSpreadParams } from './layers/virusSpread.js';
import { drawVolume, volumeParams } from './layers/volume.js';
import { drawVoronoi, voronoiParams } from './layers/voronoi.js';
import { drawVoronoiFlow, voronoiFlowParams } from './layers/voronoiFlow.js';
import { drawVuMeter, vuMeterParams } from './layers/vuMeter.js';
import { drawWaveInterference, waveInterferenceParams } from './layers/waveInterference.js';
import { drawWaveform, waveformParams } from './layers/waveform.js';
import { drawWebcam, webcamParams } from './layers/webcam.js';
import { drawWireframe3D, wireframe3DParams } from './layers/wireframe3D.js';
import { drawWireframeCity, wireframeCityParams } from './layers/wireframeCity.js';
import { drawXyOscope, xyOscopeParams } from './layers/xyOscilloscope.js';

export const WORKSHOP_LAYERS = {
    grid:            { label: "Grid",                makeParams: gridParams,                  draw: drawGrid },
    rings:           { label: "Rings",               makeParams: ringsParams,                 draw: drawRings },
    shapes:          { label: "Shapes",              makeParams: shapesParams,                draw: drawShapes },
    spectrum:        { label: "Spectrum",            makeParams: spectrumParams,              draw: drawSpectrum },
    starfield:       { label: "Starfield",           makeParams: starfieldParams,             draw: drawStarfield },
    text:            { label: "Text",                makeParams: textParams,                  draw: drawText },
    webcam:          { label: "Webcam",              makeParams: webcamParams,                draw: drawWebcam },
    volume:          { label: "Volume (3D)",         makeParams: volumeParams,                draw: drawVolume },
    plasma:          { label: "Plasma",              makeParams: plasmaParams,                draw: drawPlasma },
    freqtower:       { label: "FreqTower",           makeParams: freqTowerParams,             draw: drawFreqTower },
    mandelbulb:      { label: "Mandelbulb",          makeParams: mandelbulbParams,            draw: drawMandelbulb },
    mandelbox:       { label: "Mandelbox",           makeParams: mandelboxParams,             draw: drawMandelbox },
    apollonian:      { label: "Apollonian",          makeParams: apollonianParams,            draw: drawApollonian },
    tunnel:          { label: "Tunnel",              makeParams: tunnelParams,                draw: drawTunnel },
    voronoi:         { label: "Voronoi",             makeParams: voronoiParams,               draw: drawVoronoi },
    noise:           { label: "Noise",               makeParams: noiseParams,                 draw: drawNoise },
    media:           { label: "Video/Image",         makeParams: mediaParams,                 draw: drawMedia },
    gifbank:         { label: "GIF Bank",            makeParams: gifBankParams,               draw: drawGifBank },
    cityosm:         { label: "OSM 3D City",         makeParams: cityOsmParams,               draw: drawCityOsm },
    doomcorridor:    { label: "Doom Corridor",       makeParams: doomCorridorParams,          draw: drawDoomCorridor },
    newsticker:      { label: "News Ticker",         makeParams: newsTickerParams,            draw: drawNewsTicker },
    mastofeed:       { label: "Masto Feed",          makeParams: mastoFeedParams,             draw: drawMastoFeed },
    impacttext:      { label: "Impact Text",         makeParams: impactTextParams,            draw: drawImpactText },
    propaganda:      { label: "Propaganda",          makeParams: propagandaPosterParams,      draw: drawPropagandaPoster },
    testpat:         { label: "Test Pattern",        makeParams: testPatternParams,           draw: drawTestPattern },
    boids:           { label: "Boids Trails",        makeParams: boidsParams,                 draw: drawBoids },
    crystalgrowth:   { label: "Crystal Growth",      makeParams: crystalGrowthParams,         draw: drawCrystalGrowth },
    dnahelix:        { label: "DNA Helix",           makeParams: dnaHelixParams,              draw: drawDNAHelix },
    clifford:        { label: "Clifford",            makeParams: cliffordParams,              draw: drawClifford },
    mycelium:        { label: "Mycelium",            makeParams: myceliumParams,              draw: drawMycelium },
    ikedacircuit:    { label: "Ikeda Circuit",       makeParams: ikedaCircuitParams,          draw: drawIkedaCircuit },
    sphere3d:        { label: "Sphere 3D",           makeParams: sphere3dParams,              draw: drawSphere3D },
    neuralnet:       { label: "Neural Net",          makeParams: neuralNetParams,             draw: drawNeuralNet },
    rhizome:         { label: "Rhizome",             makeParams: rhizomeParams,               draw: drawRhizome },
    attractor:       { label: "Attractor",           makeParams: attractorParams,             draw: drawAttractor },
    slimemold:       { label: "Slime Mold",          makeParams: slimeMoldParams,             draw: drawSlimeMold },
    fpvdrone:        { label: "FPV Drone",           makeParams: fpvDroneParams,              draw: drawFpvDrone },
    circuitscanner:  { label: "Circuit Scanner",     makeParams: circuitScannerParams,        draw: drawCircuitScanner },
    swarm:           { label: "Swarm Intel",         makeParams: swarmIntelligenceParams,     draw: drawSwarmIntelligence },
    cliftscene:      { label: "Clift Scene",         makeParams: cliftSceneParams,            draw: drawCliftScene },
    ifsfractal:      { label: "IFS Fractal",         makeParams: ifsFractalParams,            draw: drawIfsFractal },
    cyclicca:        { label: "Cyclic CA",           makeParams: cyclicCAParams,              draw: drawCyclicCA },
    reactiondiff:    { label: "Reaction Diff",       makeParams: reactionDiffusionParams,     draw: drawReactionDiffusion },
    starburst:       { label: "Starburst",           makeParams: starburstParams,             draw: drawStarburst },
    gol:             { label: "Game of Life",        makeParams: golGameParams,               draw: drawGolGame },
    splineweave:     { label: "Spline Weave",        makeParams: splineWeaveParams,           draw: drawSplineWeave },
    phyllotaxis:     { label: "Phyllotaxis",         makeParams: phyllotaxisParams,           draw: drawPhyllotaxis },
    lorenzsystem:    { label: "Lorenz System",       makeParams: lorenzSystemParams,          draw: drawLorenzSystem },
    hypnoscope:      { label: "Hypnoscope",          makeParams: hypnoscopeParams,            draw: drawHypnoscope },
    stringart:       { label: "String Art",          makeParams: stringArtParams,             draw: drawStringArt },
    constellation:   { label: "Constellation",       makeParams: constellationParams,         draw: drawConstellation },
    mazecity:        { label: "Maze City",           makeParams: mazeCityParams,              draw: drawMazeCity },
    wireframe3d:     { label: "Wireframe 3D",        makeParams: wireframe3DParams,           draw: drawWireframe3D },
    neoncity:        { label: "Neon City",           makeParams: neonCityParams,              draw: drawNeonCity },
    wireframecity:   { label: "Wireframe City",      makeParams: wireframeCityParams,         draw: drawWireframeCity },
    ikedabarcode:    { label: "Ikeda Barcode",       makeParams: ikedaBarcodeParams,          draw: drawIkedaBarcode },
    ikedamatrix:     { label: "Ikeda Matrix",        makeParams: ikedaMatrixParams,           draw: drawIkedaMatrix },
    ikedaoscillo:    { label: "Ikeda Oscillo",       makeParams: ikedaOscilloParams,          draw: drawIkedaOscillo },
    ikedascan:       { label: "Ikeda Scan",          makeParams: ikedaScanParams,             draw: drawIkedaScan },
    flowfield:       { label: "Flow Field",          makeParams: flowFieldParams,             draw: drawFlowField },
    aurora:          { label: "Aurora",              makeParams: auroraParams,                draw: drawAurora },
    cymatics:        { label: "Cymatics",            makeParams: cymaticsParams,              draw: drawCymatics },
    interference:    { label: "Interference",        makeParams: interferenceParams,          draw: drawInterference },
    lavalamp:        { label: "Lava Lamp",           makeParams: lavaLampParams,              draw: drawLavaLamp },
    fire:            { label: "Fire",                makeParams: fireParams,                  draw: drawFire },
    hitomezashi:     { label: "Hitomezashi",         makeParams: hitomezashiParams,           draw: drawHitomezashi },
    hyperspace:      { label: "Hyperspace",          makeParams: hyperspaceParams,            draw: drawHyperspace },
    tesseract:       { label: "Tesseract",           makeParams: tesseractParams,             draw: drawTesseract },
    waveform:        { label: "Waveform",            makeParams: waveformParams,              draw: drawWaveform },
    moirepattern:    { label: "Moiré Pattern",       makeParams: moirePatternParams,          draw: drawMoirePattern },
    particleburst:   { label: "Particle Burst",      makeParams: particleBurstParams,         draw: drawParticleBurst },
    trontunnel:      { label: "Tron Tunnel",         makeParams: tronTunnelParams,            draw: drawTronTunnel },
    ferrofluid:      { label: "Ferrofluid",          makeParams: ferrofluidParams,            draw: drawFerrofluid },
    bzreaction:      { label: "BZ Reaction",         makeParams: bzReactionParams,            draw: drawBzReaction },
    hexgrid:         { label: "Hex Grid",            makeParams: hexGridParams,               draw: drawHexGrid },
    truchettiles:    { label: "Truchet Tiles",       makeParams: truchetTilesParams,          draw: drawTruchetTiles },
    langtonsant:     { label: "Langton's Ant",       makeParams: langtonsAntParams,           draw: drawLangtonsAnt },
    diffgrowth:      { label: "Diff Growth",         makeParams: diffGrowthParams,            draw: drawDiffGrowth },
    holographicwave: { label: "Holographic Wave",    makeParams: holographicWaveParams,       draw: drawHolographicWave },
    orbitsystem:     { label: "Orbit System",        makeParams: orbitSystemParams,           draw: drawOrbitSystem },
    turingpattern:   { label: "Turing Pattern",      makeParams: turingPatternParams,         draw: drawTuringPattern },
    hyperbolictile:  { label: "Hyperbolic Tile",     makeParams: hyperbolicTileParams,        draw: drawHyperbolicTile },
    elasticgrid:     { label: "Elastic Grid",        makeParams: elasticGridParams,           draw: drawElasticGrid },
    cyberpunkworld:  { label: "Cyberpunk World",     makeParams: cyberpunkWorldParams,        draw: drawCyberpunkWorld },
    quantumwave:     { label: "Quantum Wave",        makeParams: quantumWaveParams,           draw: drawQuantumWave },
    audiotterrain:   { label: "Audio Terrain",       makeParams: audioTerrainParams,          draw: drawAudioTerrain },
    gyroidslice:     { label: "Gyroid Slice",        makeParams: gyroidSliceParams,           draw: drawGyroidSlice },
    matrixrain:      { label: "Matrix Rain",         makeParams: matrixRainParams,            draw: drawMatrixRain },
    magiccircle:     { label: "Magic Circle",        makeParams: magicCircleParams,           draw: drawMagicCircle },
    torusknot:       { label: "Torus Knot",          makeParams: torusKnotParams,             draw: drawTorusKnot },
    supershape:      { label: "Supershape 3D",       makeParams: supershapeParams,            draw: drawSupershape },
    pendulum:        { label: "Pendulum",            makeParams: pendulumParams,              draw: drawPendulum },
    metaballs:       { label: "Metaballs",           makeParams: metaballsParams,             draw: drawMetaballs },
    arcdischarge:    { label: "Arc Discharge",       makeParams: arcDischargeParams,          draw: drawArcDischarge },
    mobiusstrip:     { label: "Möbius Strip",        makeParams: mobiusStripParams,           draw: drawMobiusStrip },
    biospost:        { label: "BIOS / Boot",         makeParams: biosPostParams,              draw: drawBiosPost },
    sysmonitor:      { label: "Sys Monitor",         makeParams: sysMonitorParams,            draw: drawSysMonitor },
    hexdump:         { label: "Hex Dump",            makeParams: hexDumpParams,               draw: drawHexDump },
    floweroflife:    { label: "Flower of Life",      makeParams: flowerOfLifeParams,          draw: drawFlowerOfLife },
    starnest:        { label: "Star Nest",           makeParams: starNestParams,              draw: drawStarNest },
    lsystem:         { label: "L-System",            makeParams: lSystemParams,               draw: drawLSystem },
    polarmandala:    { label: "Polar Mandala",       makeParams: polarMandalaParams,          draw: drawPolarMandala },
    terminalprompt:  { label: "Terminal",            makeParams: terminalPromptParams,        draw: drawTerminalPrompt },
    neonsign:        { label: "Neon Sign",           makeParams: neonSignParams,              draw: drawNeonSign },
    sevensegment:    { label: "7-Segment",           makeParams: sevenSegmentParams,          draw: drawSevenSegment },
    stockticker:     { label: "Stock Ticker",        makeParams: stockTickerParams,           draw: drawStockTicker },
    runecircle:      { label: "Rune Circle",         makeParams: runeCircleParams,            draw: drawRuneCircle },
    platonicsolid:   { label: "Platonic Solid",      makeParams: platonicSolidParams,         draw: drawPlatonicSolid },
    cubefield:       { label: "Cube Field",          makeParams: cubeFieldParams,             draw: drawCubeField },
    neongrid3d:      { label: "Neon Grid 3D",        makeParams: neonGrid3DParams,            draw: drawNeonGrid3D },
    galaxyspiral:    { label: "Galaxy Spiral",       makeParams: galaxySpiralParams,          draw: drawGalaxySpiral },
    xyoscope:        { label: "XY Oscilloscope",     makeParams: xyOscopeParams,              draw: drawXyOscope },
    vhsstatic:       { label: "VHS Static",          makeParams: vhsStaticParams,             draw: drawVhsStatic },
    radarsweep:      { label: "Radar Sweep",         makeParams: radarSweepParams,            draw: drawRadarSweep },
    juliacycles:     { label: "Julia Cycles",        makeParams: juliaCyclesParams,           draw: drawJuliaCycles },
    chladniplate:    { label: "Chladni Plate",       makeParams: chladniPlateParams,          draw: drawChladniPlate },
    typoburst:       { label: "Typo Burst",          makeParams: typoBurstParams,             draw: drawTypoBurst },
    waveinterference: { label: "Wave Interference",   makeParams: waveInterferenceParams,      draw: drawWaveInterference },
    crystallattice:  { label: "Crystal Lattice",     makeParams: crystalLatticeParams,        draw: drawCrystalLattice },
    dnasequence:     { label: "DNA Sequence",        makeParams: dnaSequenceParams,           draw: drawDnaSequence },
    mathsymbols:     { label: "Math Symbols",        makeParams: mathSymbolsParams,           draw: drawMathSymbols },
    scrollingtext:   { label: "Scrolling Text",      makeParams: scrollingTextParams,         draw: drawScrollingText },
    countdown:       { label: "Countdown",           makeParams: countdownParams,             draw: drawCountdown },
    glitchword:      { label: "Glitch Word",         makeParams: glitchWordParams,            draw: drawGlitchWord },
    pendulumwave:    { label: "Pendulum Wave",       makeParams: pendulumWaveParams,          draw: drawPendulumWave },
    nebuladust:      { label: "Nebula Dust",         makeParams: nebulaDustParams,            draw: drawNebulaDust },
    spectrogramscroll: { label: "Spectrogram",         makeParams: spectrogramScrollParams,     draw: drawSpectrogramScroll },
    prismlight:      { label: "Prism Light",         makeParams: prismLightParams,            draw: drawPrismLight },
    voronoiflow:     { label: "Voronoi Flow",        makeParams: voronoiFlowParams,           draw: drawVoronoiFlow },
    lasershow:       { label: "Laser Show",          makeParams: laserShowParams,             draw: drawLaserShow },
    clockface:       { label: "Clock Face",          makeParams: clockFaceParams,             draw: drawClockFace },
    morphshape:      { label: "Morph Shape",         makeParams: morphShapeParams,            draw: drawMorphShape },
    ribbonflow:      { label: "Ribbon Flow",         makeParams: ribbonFlowParams,            draw: drawRibbonFlow },
    circuitboard:    { label: "Circuit Board",       makeParams: circuitBoardParams,          draw: drawCircuitBoard },
    bubblesfloat:    { label: "Bubbles Float",       makeParams: bubblesFloatParams,          draw: drawBubblesFloat },
    sanddune:        { label: "Sand Dune",           makeParams: sandDuneParams,              draw: drawSandDune },
    tileflip:        { label: "Tile Flip",           makeParams: tileFlipParams,              draw: drawTileFlip },
    binaryrain:      { label: "Binary Rain",         makeParams: binaryRainParams,            draw: drawBinaryRain },
    cricbombing:     { label: "Bombing",             makeParams: cricBombingParams,           draw: drawCricBombing },
    cricwifiattack:  { label: "WiFi Attack",         makeParams: cricWifiAttackParams,        draw: drawCricWifiAttack },
    redroom:         { label: "Red Room",            makeParams: redRoomParams,               draw: drawRedRoom },
    bodyhorror:      { label: "Body Horror",         makeParams: bodyHorrorParams,            draw: drawBodyHorror },
    biospine:        { label: "Bio Spine",           makeParams: bioSpineParams,              draw: drawBioSpine },
    boidstrails:     { label: "Boids Trails",        makeParams: boidsTrailsParams,           draw: drawBoidsTrails },
    crashserver:     { label: "Crash Server",        makeParams: crashServerParams,           draw: drawCrashServer },
    glitchstorm:     { label: "Glitch Storm",        makeParams: glitchStormParams,           draw: drawGlitchStorm },
    icecave:         { label: "Ice Cave",            makeParams: iceCaveParams,               draw: drawIceCave },
    resistancenet:   { label: "Resistance Net",      makeParams: resistanceNetParams,         draw: drawResistanceNet },
    pixelsort:       { label: "Pixel Sort",          makeParams: pixelSortParams,             draw: drawPixelSort },
    surveillance:    { label: "Surveillance",        makeParams: surveillanceParams,          draw: drawSurveillance },
    virusspread:     { label: "Virus Spread",        makeParams: virusSpreadParams,           draw: drawVirusSpread },
    cpuheat:         { label: "CPU Heat",            makeParams: cpuHeatParams,               draw: drawCpuHeat },
    nuclearblast:    { label: "Nuclear Blast",       makeParams: nuclearBlastParams,          draw: drawNuclearBlast },
    drostefeedback:  { label: "Droste",              makeParams: drosteFeedbackParams,        draw: drawDrosteFeedback },
    organicmachine:  { label: "Organic Machine",     makeParams: organicMachineParams,        draw: drawOrganicMachine },
    fallingsand:     { label: "Falling Sand",        makeParams: fallingSandParams,           draw: drawFallingSand },
    quantumascii:    { label: "Quantum ASCII",       makeParams: quantumAsciiParams,          draw: drawQuantumAscii },
    fractalkaleidoscope: { label: "Fractal Kaleidoscope", makeParams: fractalKaleidoscopeParams,   draw: drawFractalKaleidoscope },
    oceandata:       { label: "Ocean Data",          makeParams: oceanDataParams,             draw: drawOceanData },
    danceparty:      { label: "Dance Party",         makeParams: dancePartyParams,            draw: drawDanceParty },
    evolutionplayground: { label: "Evolution Playground", makeParams: evolutionPlaygroundParams,   draw: drawEvolutionPlayground },
    organicmorphing: { label: "Organic Morphing",    makeParams: organicMorphingParams,       draw: drawOrganicMorphing },
    burningship:     { label: "Burning Ship",        makeParams: burningShipParams,           draw: drawBurningShip },
    fractaltree:     { label: "Fractal Tree",        makeParams: fractalTreeParams,           draw: drawFractalTree },
    inkblot:         { label: "Ink Blot",            makeParams: inkBlotParams,               draw: drawInkBlot },
    kalitunnel:      { label: "Kali Tunnel",         makeParams: kaliTunnelParams,            draw: drawKaliTunnel },
    lissajous:       { label: "Lissajous",           makeParams: lissajousParams,             draw: drawLissajous },
    magneticfield:   { label: "Magnetic Field",      makeParams: magneticFieldParams,         draw: drawMagneticField },
    newtonfractal:   { label: "Newton Fractal",      makeParams: newtonFractalParams,         draw: drawNewtonFractal },
    sandpile:        { label: "Sandpile",            makeParams: sandpileParams,              draw: drawSandpile },
    spirograph:      { label: "Spirograph",          makeParams: spirographParams,            draw: drawSpirograph },
    ulamspiral:      { label: "Ulam Spiral",         makeParams: ulamSpiralParams,            draw: drawUlamSpiral },
    vumeter:         { label: "VU Meter",            makeParams: vuMeterParams,               draw: drawVuMeter },
    black:           { label: "Black",               makeParams: blackParams,                 draw: drawBlack },
    asciifire:       { label: "ASCII Fire",          makeParams: asciiFireParams,             draw: drawAsciiFire },
    asciiplasma:     { label: "ASCII Plasma",        makeParams: asciiPlasmaParams,           draw: drawAsciiPlasma },
    asciiradar:      { label: "ASCII Radar",         makeParams: asciiRadarParams,            draw: drawAsciiRadar },
    asciiwaveform:   { label: "ASCII Waveform",      makeParams: asciiWaveformParams,         draw: drawAsciiWaveform },
    systemboot:      { label: "System Boot",         makeParams: systemBootParams,            draw: drawSystemBoot },
    pong:            { label: "Pong",                makeParams: pongParams,                  draw: drawPong },
    arabesque:       { label: "Arabesque",           makeParams: arabesqueParams,             draw: drawArabesque },
    seawaves:        { label: "Sea Waves",           makeParams: seaWavesParams,              draw: drawSeaWaves },
    coralbranch:     { label: "Coral Branch",        makeParams: coralBranchParams,           draw: drawCoralBranch },
    curlflow:        { label: "Curl Flow",           makeParams: curlFlowParams,              draw: drawCurlFlow },
    ikedadots:       { label: "Ikeda Dots",          makeParams: ikedaDotsParams,             draw: drawIkedaDots },
    ikedacoords:     { label: "Ikeda Coords",        makeParams: ikedaCoordsParams,           draw: drawIkedaCoords },
    datapulse:       { label: "Data Pulse",          makeParams: dataPulseParams,             draw: drawDataPulse },
    freqmatrix:      { label: "Freq Matrix",         makeParams: freqMatrixParams,            draw: drawFreqMatrix },
    punkstatic:      { label: "Punk Static",         makeParams: punkStaticParams,            draw: drawPunkStatic },
    breakingoverlay: { label: "Breaking Overlay",    makeParams: breakingOverlayParams,       draw: drawBreakingOverlay },
    bloodsplatter:   { label: "Blood Splatter",      makeParams: bloodSplatterParams,         draw: drawBloodSplatter },
    livecode:        { label: "Live Code",           makeParams: liveCodeParams,              draw: drawLiveCode },
    evalseismograph: { label: "Eval Seismograph",    makeParams: evalSeismographParams,       draw: drawEvalSeismograph },
    codefull:        { label: "Code Full Width",     makeParams: codeFullParams,              draw: drawCodeFull },
    codeconspiracy:  { label: "Code Conspiracy",     makeParams: codeConspiracyParams,        draw: drawCodeConspiracy },
    instrumentpop:   { label: "Instrument Pop",      makeParams: instrumentPopParams,         draw: drawInstrumentPop },
    comicpanels:     { label: "Comic Panels",        makeParams: comicPanelsParams,           draw: drawComicPanels },
    quasicrystal:    { label: "Quasicrystal",        makeParams: quasicrystalParams,          draw: drawQuasicrystal },
    systemgauge:     { label: "System Gauge",        makeParams: systemGaugeParams,           draw: drawSystemGauge },
    tooneq:          { label: "Toon EQ",             makeParams: toonEQParams,                draw: drawToonEQ },
    beatcreatures:   { label: "Beat Creatures",      makeParams: beatCreaturesParams,         draw: drawBeatCreatures },
    ransomeval:      { label: "Ransom Eval",         makeParams: ransomEvalParams,            draw: drawRansomEval },
    codecomic:       { label: "Code Comic",          makeParams: codeComicParams,             draw: drawCodeComic },
    flickerfilm:     { label: "Flicker Film",        makeParams: flickerFilmParams,           draw: drawFlickerFilm },
    scratchfilm:     { label: "Scratch Film",        makeParams: scratchFilmParams,           draw: drawScratchFilm },
    filmleader:      { label: "Film Leader",         makeParams: filmLeaderParams,            draw: drawFilmLeader },
};

export const WORKSHOP_NAMES = Object.keys(WORKSHOP_LAYERS);

// ── Per-layer FX ─────────────────────────────────────────────────────────────
// The workshop's effects are CANVAS operations — apply(src, outCtx, w, h, p, entry, t)
// — so they run per LAYER, on that layer's own canvas, before it reaches the deck.
// crashDot's own FX are the opposite: uniforms in the present shader, applied once to
// the whole frame. Both are kept, and they are genuinely different tools — "bloom this
// one layer" was not previously expressible.
//
// `entry` is the stack slot itself, passed through so stateful effects (feedback,
// datamosh, frameDiff, motionBlur) can keep a buffer on it across frames. That is why
// a caller must hold its entries rather than rebuild them each frame.
export { FX_KINDS as WORKSHOP_FX } from './fx/registry.js';
import { FX_KINDS } from './fx/registry.js';
export const WORKSHOP_FX_NAMES = Object.keys(FX_KINDS);

/** Flatten one effect's param descriptors to plain defaults. */
export function fxDefaults(type) {
    const k = FX_KINDS[type];
    if (!k) return {};
    let d = {};
    try { d = k.makeParams() || {}; } catch (_) { return {}; }
    const out = {};
    for (const [n, v] of Object.entries(d)) out[n] = (v && typeof v === 'object' && 'base' in v) ? v.base : v;
    return out;
}
/** The first declared param — what a bare `bloom(0.4)` sets. */
export function fxPrimary(type) {
    const d = fxDefaults(type);
    const k = Object.keys(d);
    return k.length ? k[0] : null;
}

/** Flatten a layer's param descriptors to plain defaults: { name: base }. */
export function defaults(kind) {
    const k = WORKSHOP_LAYERS[kind];
    if (!k) return {};
    let desc = {};
    try { desc = k.makeParams() || {}; } catch (_) { return {}; }
    const out = {};
    for (const [n, d] of Object.entries(desc)) out[n] = (d && typeof d === 'object' && 'base' in d) ? d.base : d;
    return out;
}

/** The declared range of one param, for knobs and for clamping. */
export function paramRange(kind, name) {
    const k = WORKSHOP_LAYERS[kind];
    if (!k) return null;
    let desc = {};
    try { desc = k.makeParams() || {}; } catch (_) { return null; }
    const d = desc[name];
    return (d && typeof d === 'object' && 'base' in d) ? { min: d.min, max: d.max, base: d.base } : null;
}
