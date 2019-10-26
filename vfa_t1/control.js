/*
================== qMRLab vfa_t1 pulse sequence = 
This is the controller script which is responsible for 
passing the variables between the GUI (control.ui) and 
RTHawk's sequencing engine.    

Waveforms exported by SpinBench and described by application.apd
determine the initial state of the sequence. For this 
application, initial parameters are fetched from: 

- [excitation] SincRF + Z (SlabSelect.spv)
- [echodelay] in us, to be exposed to GUI. (Not linked to a file)
- [readout] 3D Cartesian Readout (CartesianReadout3D.spv)
- [spoiler] Area Trapezoid  (SpoilerGradient.spv)

Author:  Agah Karakuzu agahkarakuzu@gmail.com
Created: October, 2019. 
// =================================================
*/

// Get sequence ID
var sequenceId  = rth.sequenceId();

// Fetch initial parameters described in CartesianReadout3D.spv 
var xRes = SB.readout["<Cartesian Readout>.xRes"];
var yRes = SB.readout["<Cartesian Readout>.yRes"];
var zRes = SB.readout["<Phase Encode Gradient>.res"];

rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "xSize", xRes));
rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "ySize", yRes));
rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "zSize", zRes));

// Get minimum TR
var scannerTR = new RthUpdateGetTRCommand(sequenceId, [], []);
rth.addCommand(scannerTR);
var minTR = scannerTR.tr();
var startingTR = minTR;

// Starting FOV also depends on CartesianReadout3D.spv
// In SpinBench, FOV is defined in cm. 
var startingFOV = SB.readout["<Cartesian Readout>.fov"]; // cm

// Slice thickness depends on SlabSelect.spv
// In SpinBench, SliceThickness is defined in mm. 
var startingThickness = SB.excitation["<Slice Select Gradient>.thickness"]; // mm

rth.informationInsert(sequenceId,"mri.SliceThickness",startingThickness);
var startingResolution = startingFOV/SB.readout["<Cartesian Readout>.xRes"] * 10; // mm
var startingZResolution = startingThickness/zRes * 10; // At the beginning zFOV equaled to slice thickness of SS

var startingTE = 3; //ms
// Start of TE is anchored to the tip of sinc RF.
var peakLocation  = SB.excitation["<Sinc RF>.peak"];
rth.informationInsert(sequenceId,"mri.EchoTime",startingTE + peakLocation);

// Assume FA from SB as the smaller.
var startingFA2 = SB.excitation["<Sinc RF>.tip"]; //20
// FA should be in decreasing order (FA1 > FA2)
var startingFA1 = startingFA2 - 17;


var sliceThickness = startingThickness;
var fieldOfView = startingFOV;

//FIXME: This is temporary. Fix the order
var flipAngle1 = startingFA2;
var flipAngle2 = startingFA1;

var echoTime = startingTE;
var repetitionTime = startingTR;

// Import display tool

rth.importJS("lib:RthDisplayThreePlaneTools.js");
var displayTools = new RthDisplayThreePlaneTools();

// Change functions

function changeFOV(fov){
  if (fov<startingFOV) fov = startingFOV; // Dont allow smaller FOV
  var scale = startingFOV/fov;

  // Update FOV
  
  // Scale gradients (x,y,z) assuming in-plane isometry
  rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId,"readout",scale,scale,1));

  // Waveforms are not affected by the below: 
  rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId,startingResolution/scale));
  rth.addCommand(new RthUpdateChangeFieldOfViewCommand(sequenceId, fov*10));

  // Annotation
  displayTools.setFOV(fov * 10);
  //displayTool.setResolution(startingResolution/scale,startingResolution/scale);
  // Update
  fieldOfView = fov;
}

function changeSliceThickness(thickness){
  if (thickness < startingThickness) thickness = startingThickness;

  // Scale SS gradient
  // Always referenced with respect to the beginning value described by the SB. 
  rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId,"excitation",1,1,startingThickness/thickness));
  // Scale Gz in readout as well 
  rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId,"readout",1,1,startingThickness/thickness));

  // Update info 
  rth.addCommand(new RthUpdateChangeSliceThicknessCommand(sequenceId, thickness));

  // Inject metadata for the image to update RthInfoInsert kinda thing.  

  displayTools.setSliceThickness(thickness);
  rth.informationInsert(sequenceId,"mri.SliceThickness",thickness);
  sliceThickness = thickness;

}

function changeTR(tr) {
  if (tr < minTR) {
    tr = minTR;
  }
  // TR is a generic integer parameter, so to be updated by RthUpdateIntParameterCommand
  // Method name is given by "setDesiredTR", defined in microseconds!

  var value = tr * 1000; // Convert from milisec to microsec
  var trCommand = new RthUpdateIntParameterCommand(sequenceId, "", "setDesiredTR", "", value);

  rth.addCommand(trCommand);
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "RepetitionTime", tr));

  repetitionTime = tr;

}

function changeFlipAngle1(angle1) {
  //var flipCommand = RthUpdateFloatParameterCommand(sequenceId, "sequence", "scaleRF", "", angle / startingFA1);
  //rth.addCommand(flipCommand);
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "FlipAngle1", angle1));

  flipAngle1 = angle1;
}

function changeFlipAngle2(angle2){
  // Just referencing global var here.
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "FlipAngle2", angle2));

  flipAngle2 = angle2;
}

function changeTE(te)
{
  te += peakLocation;
  rth.informationInsert(sequenceId,"mri.EchoTime",te);

  var value = te * 1000; // Convert to usec
  rth.addCommand(new RthUpdateIntParameterCommand(sequenceId, "echodelay", "setDelay", "EchoTime", te));
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "EchoTime", te));
  

}


/* Define UI element settings and link outputs from change events to the respective vars
  inputWidget_FOV (Done)
  inputWidget_SliceThickness (Done)
  inputWidget_FA1 (Done)
  inputWidget_FA2 (Done)
  inputWidget_TR  (Done)
*/

controlWidget.inputWidget_SliceThickness.minimum = startingThickness;
controlWidget.inputWidget_SliceThickness.maximum = startingThickness*2;
controlWidget.inputWidget_SliceThickness.value   = startingThickness;

controlWidget.inputWidget_FOV.minimum = 20;
controlWidget.inputWidget_FOV.maximum = startingFOV*2;
controlWidget.inputWidget_FOV.value   = startingFOV;

controlWidget.inputWidget_TR.minimum = minTR;
controlWidget.inputWidget_TR.maximum = minTR + 30;
controlWidget.inputWidget_TR.value   = minTR;

//FIXME: FA param names  
controlWidget.inputWidget_FA1.minimum = startingFA1;
controlWidget.inputWidget_FA1.maximum = 90;
controlWidget.inputWidget_FA1.value   = startingFA2;
//FIXME: FA param names 
controlWidget.inputWidget_FA2.minimum = startingFA1;
controlWidget.inputWidget_FA2.maximum = startingFA1+5;
controlWidget.inputWidget_FA2.value   = startingFA1;

controlWidget.inputWidget_TE.minimum = 1;
controlWidget.inputWidget_TE.maximum = 8;
controlWidget.inputWidget_TE.value   = 3;


controlWidget.inputWidget_FOV.valueChanged.connect(changeFOV);
changeFOV(controlWidget.inputWidget_FOV.value);

controlWidget.inputWidget_TR.valueChanged.connect(changeTR);
changeTR(controlWidget.inputWidget_TR.value);

controlWidget.inputWidget_FA1.valueChanged.connect(changeFlipAngle1);
changeFlipAngle1(controlWidget.inputWidget_FA1.value);

controlWidget.inputWidget_FA2.valueChanged.connect(changeFlipAngle2);
changeFlipAngle2(controlWidget.inputWidget_FA2.value);

controlWidget.inputWidget_TE.valueChanged.connect(changeTE);
changeTE(controlWidget.inputWidget_TE.value);

// Add loop commands

var bigAngleCommand = new  RthUpdateFloatParameterCommand(sequenceId, "excitation", "scaleRF", "", 1);
// Following sets FlipAngle to 3 when FA1 = 30 and FA2=25 
var smallAngleCommand = new  RthUpdateFloatParameterCommand(sequenceId, "excitation", "scaleRF", "", flipAngle2/flipAngle1);

var infoCommand1 = new RthUpdateChangeMRIParameterCommand(sequenceId,"FlipAngle", flipAngle1);
var infoCommand2 = new RthUpdateChangeMRIParameterCommand(sequenceId,"FlipAngle", flipAngle2);

var updateGroup1 = new RthUpdateGroup([bigAngleCommand, infoCommand1]);
var updateGroup2 = new RthUpdateGroup([smallAngleCommand, infoCommand2]);

var loopCommands = [updateGroup1, updateGroup2];

rth.setLoopCommands(sequenceId, "tiploop", loopCommands);

