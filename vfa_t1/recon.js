/*
================== qMRLab vfa_t1 pulse sequence = 
This script is responsible for collecting raw data 
and reconstructing images. 
 
Waveforms exported by SpinBench and described by application.apd
determine the initial state of the sequence. For this 
application, initial parameters are fetched from: 

- [excitation] SincRF + Z (SlabSelect.spv)
- [echodelay] in us, to be exposed to GUI. (Not linked to a file)
- [readout] 3D Cartesian Readout (CartesianReadout3D.spv)
- [spoiler] Area Trapezoid  (SpoilerGradient.spv)

For now, base resolution components are hardcoded to be 
256X256mm (inplane) and 5mm (slab thickness) for the 
3D readout. 

TODO: These parameters are to be fetched from controller. 

Author:  Agah Karakuzu agahkarakuzu@gmail.com
Created: October, 2019. 
// =================================================
*/

var sequenceId = rth.sequenceId();
var instanceName = rth.instanceName();

var observer = new RthReconRawObserver();
observer.setSequenceId(sequenceId);
observer.observeValueForKey("acquisition.samples", "samples");


function reconBlock(input) {

  this.sort = new RthReconRawToImageSort();
  
  this.sort.setPhaseEncodes(256);
  this.sort.setSamples(256);
  this.sort.setSliceEncodes(5);

  this.sort.setAccumulate(256*5);

  this.sort.setInput(input);

  this.fft = new RthReconImageFFT();
  this.fft.setInput(this.sort.output());

  this.output = function() {
  return this.fft.output();
  };
}

// For each `coil we need sort and FFT.

var sos = new RthReconImageSumOfSquares();
var block  = [];

function connectCoils(coils){
  block = [];
  for (var i = 0; i<coils; i++){
    block[i] = new reconBlock(observer.output(i));
    sos.setInput(i,block[i].output());
  }
 rth.collectGarbage();
}

observer.coilsChanged.connect(connectCoils);

rth.importJS("lib:RthImageThreePlaneOutput.js");

var date = new Date();

//var imageExport = new RthReconToQmrlab();
var imageExport = new RthReconImageExport();
var exportDirectory = "/home/agah/Desktop/AgahHV/";
var exportFileName  = exportDirectory + instanceName + date.getFullYear() + date.getMonth() + date.getSeconds() + '.dat';
imageExport.objectName = "save_image";

var splitter = RthReconSplitter();
splitter.objectName = "splitOutput";
splitter.setInput(sos.output());

imageExport.setFileName(exportFileName);
RTHLOGGER_WARNING("saving...");

imageExport.saveFileSeries(true);

var threePlane = new RthImageThreePlaneOutput();
threePlane.setInput(splitter.output(0));
imageExport.setInput(splitter.output(1));
